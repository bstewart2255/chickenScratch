# Signature Authentication Prototype

This project is a full-stack application for user authentication based on signature biometrics. It includes a frontend for user interaction, a backend for data processing and API endpoints, and a machine learning model for signature verification.

## Architecture

The application is composed of three main parts:

1.  **Frontend:** A web-based interface for user registration and authentication. Users can enroll by providing a signature, and then authenticate by providing a new signature for comparison.
2.  **Backend:** A Node.js application that provides a RESTful API for the frontend. It handles user management, data storage, and communication with the ML model.
3.  **ML Model:** A Python-based machine learning model that provides signature verification services. It's exposed as a separate API that the backend communicates with.

For a more detailed explanation of the architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Getting Started

### Prerequisites

*   Node.js and npm
*   Python 3 and pip
*   PostgreSQL

### Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/your-username/signature-auth-prototype.git
    cd signature-auth-prototype
    ```

2.  **Install backend dependencies:**

    ```bash
    cd backend
    npm install
    ```

3.  **Install ML model dependencies:**

    ```bash
    cd ../ml-model
    pip install -r requirements.txt
    ```

### Database Setup

1.  **Create a PostgreSQL database.**
2.  **Set the `DATABASE_URL` environment variable** in a `.env` file in the `backend` directory. See `backend/.env.example` for an example.
3.  **Run the database migrations:**

    ```bash
    cd backend
    node run_migrations.js
    ```

### Running the Application

1.  **Start the backend server:**

    ```bash
    cd backend
    npm start
    ```

    The backend will be available at `http://localhost:3000`.

2.  **Start the ML model server:**

    ```bash
    cd ../ml-model
    ./start_ml_server.sh
    ```

    The ML model server will be available at `http://localhost:5002`.

3.  **Open the frontend in your browser:**

    Open `frontend/index.html` in your web browser.

## Documentation

For more detailed documentation, see the `docs` directory. It contains:

*   **Guides:** Step-by-step instructions for specific tasks.
*   **Summaries:** Explanations of changes and new features.
*   **Reports:** In-depth analysis of specific issues.

## Testing

To run the backend tests:

```bash
cd backend
npm test
```
