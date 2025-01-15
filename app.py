# -- coding: utf-8 --

from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer
import numpy as np
from lucknowllm import GeminiModel
from pymongo import MongoClient
import spacy

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration for the RAG System
MODEL_NAME = 'paraphrase-MiniLM-L6-v2'
API_KEY = "AIzaSyAaYz8BkhIrEYILlswTGDJQPBEWXCuKrTI"
GEMINI_MODEL_NAME = "gemini-1.0-pro"
TOP_N = 3

# MongoDB configuration
MONGO_URI = "mongodb+srv://learning:learning@cluster0.ldnz1.mongodb.net/"
DATABASE_NAME = "project_db"
COLLECTION_NAME = "documents"

# Initialize MongoDB client
client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]
collection = db[COLLECTION_NAME]

# Initialize models
sentence_model = SentenceTransformer(MODEL_NAME)
gemini_model = GeminiModel(api_key=API_KEY, model_name=GEMINI_MODEL_NAME)

# Initialize spaCy
nlp = spacy.load("en_core_web_sm")

def parse_query_to_criteria(query):
    """
    Parse a human-readable query into structured criteria using NLP.
    """
    criteria = {}
    doc = nlp(query)

    # Extract product type (look for nouns)
    for token in doc:
        if token.text.lower() in ["moisturizer", "cleanser", "sunscreen", "cream"]:
            criteria["product_type"] = "product"

    # Extract price range
    if "affordable" in query.lower() or "cheap" in query.lower():
        criteria["price_range"] = "affordable"
    if "premium" in query.lower() or "expensive" in query.lower():
        criteria["price_range"] = "premium"

    # Extract ingredients (look for named entities or specific keywords)
    ingredients = []
    for ent in doc.ents:
        if ent.text.lower() in ["aloe vera", "hyaluronic acid", "SPF", "glycerin", "ceramides"]:
            ingredients.append(ent.text.lower())
    for token in doc:
        if token.text.lower() in ["aloe", "SPF", "hyaluronic", "glycerin", "ceramides"]:
            ingredients.append(token.text.lower())
    if ingredients:
        criteria["ingredients"] = list(set(ingredients))  # Remove duplicates

    return criteria

def split_into_segments(text, max_length=512):
    # Split the text into chunks of max_length characters
    return [text[i:i + max_length] for i in range(0, len(text), max_length)]

def search_products(criteria):
    """
    Search for products based on the given criteria.
    """
    mongo_query = {}

    # Match product type
    if "product_type" in criteria:
        mongo_query["type"] = criteria["product_type"]

    # Match ingredients
    if "ingredients" in criteria:
        mongo_query["description"] = {"$regex": "|".join(criteria["ingredients"]), "$options": "i"}

    # Match price range (if required)
    if "price_range" in criteria:
        if "description" in mongo_query:
            if criteria["price_range"] == "affordable":
                mongo_query["description"]["$regex"] += "|affordable|cheap|below \\$20"
            elif criteria["price_range"] == "premium":
                mongo_query["description"]["$regex"] += "|premium|luxury|above \\$20"

    # Log the MongoDB query
    print("MongoDB Query:", mongo_query)

    # Query the database
    results = collection.find(mongo_query)

    # Handle missing description fields and log issues
    results_list = []
    for product in results:
        if "description" not in product:
            print(f"Skipping product without 'description': {product}")
        else:
            results_list.append(product)

    # Log the results
    print("MongoDB Results:", results_list)

    # Return formatted results
    return [
        {
            "product_name": product.get("product_name", "N/A"),
            "description": product.get("description", "N/A")
        }
        for product in results_list
    ]

def load_and_preprocess_data(queries):
    """
    Process each query's criteria and fetch matching products, returning processed chunks.
    """
    all_chunks = []
    for query in queries:
        if isinstance(query, str):
            criteria = parse_query_to_criteria(query)  # Parse plain text query
            print(f"Parsed criteria for query '{query}': {criteria}")
        else:
            criteria = query.get("criteria", {})

        products = search_products(criteria)

        # Log when no products are found for criteria
        if not products:
            print(f"No products found for criteria: {criteria}")
            continue

        for product in products:
            try:
                # Combine product data into a single string
                merged_text = (
                    f"Product Name: {product['product_name']}\n"
                    f"Description: {product['description']}\n"
                )
                all_chunks.extend(split_into_segments(merged_text))
            except KeyError as e:
                print(f"Missing key in product data: {e}, product: {product}")

    # Log if no chunks are created
    if not all_chunks:
        print("No data to process into chunks.")
    else:
        print(f"Chunks created: {all_chunks}")

    return all_chunks

def embed_text_data(model, text_data):
    return model.encode(text_data)

def cosine_similarity(a, b):
    return np.dot(a, b.T) / (np.linalg.norm(a, axis=1)[:, np.newaxis] * np.linalg.norm(b, axis=1))

def find_top_n_similar(query_vec, data_vecs, top_n=3):
    similarities = cosine_similarity(query_vec[np.newaxis, :], data_vecs)
    top_indices = np.argsort(similarities[0])[::-1][:top_n]
    return top_indices

def generate_gemini_response(prompt):
    return gemini_model.generate_content(prompt)

def main(queries):
    """
    Process queries, embed data, and generate responses.
    """
    # Preprocess data and retrieve chunks
    chunks = load_and_preprocess_data(queries)
    
    # Handle case where no chunks are available
    if not chunks:
        return ["No products found matching the given criteria."]

    # Embed data and queries
    embedded_data = embed_text_data(sentence_model, chunks)
    query_texts = [query if isinstance(query, str) else query.get("query", "") for query in queries]
    embedded_queries = embed_text_data(sentence_model, query_texts)

    responses = []
    for i, query_vec in enumerate(embedded_queries):
        top_indices = find_top_n_similar(query_vec, embedded_data, TOP_N)
        top_documents = [chunks[index] for index in top_indices]

        prompt = f"You are an intelligent assistant. I'll give you a question and context, and you'll return the answer. Query: {query_texts[i]} Contexts: {top_documents[0]}"
        model_output = generate_gemini_response(prompt)

        responses.append(model_output)

    return responses

@app.route('/query', methods=['POST'])
def query():
    data = request.get_json()
    queries = data.get('queries', [])
    if not queries:
        return jsonify({'error': 'No queries provided'}), 400

    try:
        responses = main(queries)
        return jsonify({'responses': responses}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
