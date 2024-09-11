import fs from 'fs';
import pdf from 'pdf-parse';
import dotenv from 'dotenv';

dotenv.config();

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function extractTextFromPDF(filePath) {
    try {
        // Read the PDF file
        const dataBuffer = fs.readFileSync(filePath);
        
        // Parse the PDF
        const data = await pdf(dataBuffer);
        
        // Return the extracted text
        return data.text;
    } catch (err) {
        console.error('Error extracting text from PDF:', err);
    }
}

export async function getEmbedding(text) {
    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);
        const embedding = result.embedding;
        return embedding;
    } catch (error) {
        console.error('Error generating embeddings:', error);
        throw error;
    }
}

function chunkText(text, wordLimit) {
    const words = text.split(/\s+/); // Split text by whitespace
    const chunks = [];

    for (let i = 0; i < words.length; i += wordLimit) {
        chunks.push(words.slice(i, i + wordLimit).join(' '));
    }

    return chunks;
}

export async function processPDF(filePath) {
    try {
        // Step 1: Extract text from the PDF
        const extractedText = await extractTextFromPDF(filePath);
        // console.log('Extracted Text:', extractedText);

        // Step 2: Divide the text into chunks of 1000 words each
        const chunks = chunkText(extractedText, 50);

        // Step 3: Generate embeddings for each chunk and store them in an array
        const embeddings = [];
        for (const chunk of chunks) {
            // console.log("each chunk:", chunk);
            const embedding = await getEmbedding(chunk);
            embeddings.push(embedding);
            // console.log('Chunk Embedding Length:', embedding.values.length);
        }
        
        // Output all embeddings
        // console.log('All Embeddings:', embeddings);
        return { chunks, embeddings };
    } catch (error) {
        console.error('Error processing PDF:', error);
    }
}
