# Technical Architecture Proposal: RAG Office Portal

## Executive Summary
This document outlines the proposed architecture for the Office Portal's backend, specifically detailing the integration of the Retrieval-Augmented Generation (RAG) pipeline. The system is designed to securely ingest documents (such as meeting transcripts), store them efficiently using a hybrid database approach, and serve AI-generated insights via a highly performant API.

---

## 1. High-Level Architecture Diagram

```mermaid
flowchart TD
    %% External / Client Layer
    subgraph User Interaction
        A["💻 Frontend Application\n(React)"]
    end

    subgraph Inputs
        H["📄 Documents\n(Meeting Ingestion Source)"]
    end

    %% Deployment Environment
    subgraph Docker ["🐳 Dockerized Environment"]
        
        subgraph Backend Services
            B["⚡ FastAPI Backend\n(Core API & Orchestration)"]
            F["⚙️ RAG Pipeline\n(Processing & Logic)"]
        end

        subgraph Data Stores
            D[("🗄️ PostgreSQL\n(Relational / Metadata)")]
            E[("🗂️ Qdrant\n(Vector Database)")]
        end
    end

    %% External APIs
    subgraph External
        G["🧠 External LLM\n(e.g., OpenAI/Gemini)"]
    end

    %% Data Flow Connections
    A -- "1. API Requests" --> B
    
    %% Backend Logic
    B -- "2. Reads/Writes" --> D
    B -- "3. Orchestrates" --> F
    B -- "4. Performs Vector Search" --> E
    
    %% RAG Pipeline Logic
    H -- "Ingests" --> F
    F -- "Embeds & Stores" --> E
    F -- "Retrieves Context" --> E
    F -- "Sends Prompt + Context" --> G
    G -- "Returns Generation" --> F