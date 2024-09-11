import { QdrantClient } from "@qdrant/js-client-rest";
import path from 'path';
import { processPDF, getEmbedding } from './embedings.js';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();
const client = new QdrantClient({ host: "172.17.10.125", port: 6333 });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

async function createOrSkipCollection(collectionName) {
    try {
        const collections = await client.getCollections();
        const collectionExists = collections.collections.some(col => col.name === collectionName);

        if (!collectionExists) {
            await client.createCollection(collectionName, {
                vectors: { size: 768, distance: "Cosine" }, // Adjust vector size based on your model's embedding dimension
            });
            console.log(`Collection '${collectionName}' created successfully.`);
        } else {
            console.log(`Collection '${collectionName}' already exists, skipping creation.`);
        }
    } catch (error) {
        console.error('Error creating collection:', error);
    }
}

async function upsertData() {
    try {
        await createOrSkipCollection("demo123");

        const filePath = path.resolve('./Warranty1.pdf');
        // console.log('File Path:', filePath);
        const { chunks, embeddings } = await processPDF(filePath);

        const data = [];
        for (let i = 0; i < chunks.length; i++) {
            data.push({ id: i + 1, vector: embeddings[i].values, payload: { text: chunks[i] } });
        }

        const operationInfo = await client.upsert("demo123", {
            wait: true,
            points: data,
        });

        // console.log('Upsert operation result:', operationInfo);
    } catch (error) {
        console.error('Error in upserting data:', error);
    }
}

async function searchCollection(query) {
    try {
        // Step 1: Generate embedding for the query
        const embed = await getEmbedding(query);
        // console.log('Embedding for query:', embed.values);
        
        // Step 2: Search in Qdrant using the query embedding
        const searchResult = await client.search("demo123", {
            vector: embed.values, // Query vector
            limit: 5,             // Limit to top 5 results
            score_threshold: 0.45 // Threshold for match quality
        });

        // console.log('Search result:', searchResult);

        const searchResultsText = [];
        for (const dist of searchResult) {
            searchResultsText.push(dist.payload.text);
        }

        return searchResultsText;
    } catch (error) {
        console.error('Error in searching collection:', error);
    }
}

async function generateResponse(query) {
    try {
        // Step 1: Search for vectors in the Qdrant collection
        const searchResultsText = await searchCollection(query);
        // console.log('Search Results Text:', searchResultsText);
        
        // Step 2: Use Gemini LLM to generate a response
        const context = searchResultsText.join('\n'); // Join all retrieved texts as context
        const prompt = `${context}\n\nUser's question: ${query} if the query not related to the context ask user to give correct promt for better answers avoid useing the newlines in answer
        output should be  in json like {Answer:answer}`;
        
     
        
        const result = await model.generateContent(prompt);
        console.log(result.response.text());

        
    } catch (error) {
        console.error('Error generating response with Gemini LLM:', error);
    }
}

// Run the functions
upsertData().then(() => {
    const userQuery = "miracle"; // Example query
    generateResponse(userQuery);
});
