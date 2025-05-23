# DropShare Backend

This is the backend server for the DropShare file sharing application. It provides API endpoints for uploading and downloading files.

## Features

- File upload with Multer
- File download with unique ID
- File expiration after 7 days
- TypeScript support

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

The server will run on http://localhost:3001 by default.

## API Endpoints

- `POST /api/upload` - Upload a file (multipart/form-data with 'file' field)
- `GET /api/file/:id` - Get file information
- `GET /api/download/:id` - Download a file

## Build for Production

```bash
npm run build
npm start
```
