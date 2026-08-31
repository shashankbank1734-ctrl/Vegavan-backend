# Vegavan AI Backend — High-Performance Customer Support Engine

Vegavan AI is a high-performance, multi-tenant conversational SaaS backend that allows businesses to create, train, and deploy custom AI customer receptionists grounded in corporate knowledge. Powered by Node.js, Express, MongoDB, and **Gemini 3 Flash**, it guarantees zero hallucination support in milliseconds.

---

## ⚡ Core Features

-   **Context Grounded AI**: Deep integration with Gemini 3 Flash for fast, accurate response generation restricted strictly to corporate knowledge base segments.
-   **Multi-Tenant Architecture**: Complete workspace isolation ensuring safe database segregation for multiple client accounts.
-   **Visitor Lead Capture**: Pre-chat visitor authentication to collect names and phone numbers before chat threads begin.
-   **Encapsulated Shadow DOM Widget Delivery**: Serves an insulated client script (`chatbot.js`) that embeds seamlessly into any website without layout shifts or styling conflicts.

---

## 🛠️ Technology Stack

-   **Runtime Environment**: Node.js
-   **Web Framework**: Express.js
-   **Database**: MongoDB (via Mongoose ODM)
-   **AI Core**: Google Gemini 3 Flash API
-   **Security**: JSON Web Tokens (JWT) & bcryptjs password hashing

---

## 🚀 Setup & Installation

### 1. Clone & Navigate
```bash
cd Backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root of the `Backend` directory and define the following variables:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_jwt_secret
GEMINI_API_KEY=your_gemini_api_key
```

### 4. Run Development Server
```bash
npm run dev
```
The server will boot and run on `http://localhost:5000`.

---

## 🛣️ API Endpoints Summary

### Authentication Routes (`/api/auth`)
-   `POST /api/auth/register` — Registers a new developer/business account.
-   `POST /api/auth/login` — Authenticates a user and returns a JWT access token.

### Chatbot Configuration (`/api/chatbot`)
-   `GET /api/chatbot/config` — Retrieves the customized chatbot styling, copy, and tone configuration.
-   `POST /api/chatbot/config` — Updates the chatbot persona settings.

### Knowledge Base (`/api/chatbot/knowledge`)
-   `GET /api/chatbot/knowledge` — Retrieves trained FAQ and documentation blocks.
-   `POST /api/chatbot/knowledge` — Adds a new knowledge base segment.

### Visitor Leads (`/api/chatbot/leads`)
-   `GET /api/chatbot/leads` — Retrieves captured lead information (Name, Phone, Last Message).
-   `POST /api/chatbot/leads` — Submits a newly captured pre-chat lead.

---

## 📄 License

Created and engineered as a sub-brand of **Webflora Technologies**. All rights reserved.
