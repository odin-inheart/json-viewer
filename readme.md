# JSON Viewer / Editor

## 1. Project Overview

This project is a web-based JSON Viewer and Editor developed during a Web Development Internship.

The goal of the application is to allow an internal technical team to:

- Load a JSON file
- Visualize its content in a readable and structured way
- Edit the JSON safely
- Validate data according to defined rules
- Save or download the JSON without altering its original structure

## 2. Scope of the Application

The application focuses on:

- Editing existing JSON files
- Preserving 100% of the original JSON structure
- Avoiding any persistence of UI-only helper data

The application is not intended to:

- Replace a database
- Automatically restructure or normalize JSON
- Perform schema migration

## 3. Features

### 3.1 JSON Input

- Load JSON from the server
- Import a local .json file
- Reject any non-JSON file

### 3.2 Table View (Excel-like)

- Display JSON data in a table
- Inline cell editing
- Boolean values rendered as checkboxes
- Fixed-width columns with ellipsis (...)
- Filters by text and by column
- Section-based navigation (arrays / objects)

### 3.3 Raw JSON View

- Display the full JSON as text
- Edit JSON directly
- Case-insensitive text search
- Navigate between matches (Next / Previous)

### 3.4 Persistence

- Save JSON to the server
- Download JSON as a file
- No UI helper keys included in saved JSON

### 3.5 User Interface

- Light / Dark mode
- Clear error and status messages

## 4. Technical Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js + Express
- Styling: Bootstrap (latest version via CDN)
- Storage: JSON file stored on the server filesystem
- Development tools: npm, nodemon

## 5. How to Run the Project

### Prerequisites

- Node.js v24.11 (or compatible)

### Installation

npm install

### Run

npm run dev

Access the application at:

http://localhost:8888

## 6. Design Decisions

Key design choices:

- No frontend framework (React, Vue, etc.) to keep logic explicit and readable
- Clear separation between table projection and raw JSON editing
- All edits are reversible until explicitly saved
- The JSON structure is never modified implicitly
- UI helper logic is strictly excluded from persisted data

## 7. Limitations & Future Improvements

Possible future improvements:

- JSON schema validation
- Undo / redo history
- Column sorting
- Read-only mode for sensitive fields
- Multi-file JSON merging

## 8. Author

- Developed by: Odin DOUTEAUX
- Internship: Web Development Internship / Test Internship
- Company: InHeart

# User Guide

This section explains how to use the application from a user perspective.

## 9. Loading a JSON File

### 9.1 Load JSON from Server

1. Click Load JSON from server
2. The application retrieves the JSON via the backend API
3. The JSON is displayed in:
   - the table view
   - the raw JSON editor

If the server returns invalid JSON, an error message is displayed.

### 9.2 Load a Local JSON File

1. Click Browse
2. Select a .json file from your computer
3. The file is validated and loaded

If the file is not a JSON file, loading is rejected with an error message.

## 10. Navigating the Data (Table View)

- Select a section from the dropdown (arrays or object-based datasets)
- Data is displayed in an Excel-like table
- Each row represents one JSON entry
- Each column represents a JSON property

Additional behavior:

- Long values are truncated with ...
- Boolean values are shown as checkboxes

## 11. Editing Data in the Table

1. Click inside a cell
2. Modify the value directly

Changes are not saved until explicitly saved to the server.

The application ensures:

- JSON structure is preserved
- No UI helper fields are added

## 12. Filtering Data

### 12.1 Text Filter

- Type text in the filter input
- Only rows containing the text (case-insensitive) are displayed

### 12.2 Column Filter

- Select a column from the dropdown
- Only rows with a value in that column are displayed

### 12.3 Reset Filters

- Click Reset filters
- All filters are cleared and all rows are shown again

## 13. Raw JSON View

The raw editor displays the full JSON content.

You can:

- Inspect the complete JSON structure
- Edit the JSON manually
- Use the text filter to search inside the JSON

### Raw Search

1. Type text in the filter input
2. Use Next / Previous buttons to navigate matches
3. Matches are highlighted via cursor selection

This mode is intended for advanced users.

## 14. Saving the JSON

### Save to Server

1. Click Save JSON to server
2. JSON is validated
3. Business rules are checked

If validation passes, the JSON is persisted on the server.
If a rule is violated, saving is blocked and an error message is shown.

## 15. Downloading the JSON

1. Click Download JSON
2. A .json file is generated from the current data

The downloaded file:

- Preserves the original structure
- Contains no UI helper keys

## 16. Theme Selection

- Click the Light / Dark mode toggle
- The selected theme is saved locally
- The theme is restored automatically on the next visit

## 17. Error Handling

The application displays clear messages when:

- Invalid JSON syntax is detected
- Non-JSON files are loaded
- Business rules are violated
- Server operations fail

## 18. Intended Usage Notes

- Always save explicitly after editing
- Prefer table view for structured edits
- Use raw view for inspection and advanced search
- Do not edit identifier keys unless necessary
