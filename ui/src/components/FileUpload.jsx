import React, { useState } from "react";
import axios from "axios";
import { Button, Box, Typography, Grid2, Container } from "@mui/material";

/**
 * File upload component that handles document parsing and analysis.
 * Provides a user interface for uploading files and displays upload status.
 * 
 * @param {Function} onFileParsed - Callback function to handle parsed file data
 */
function FileUpload({ onFileParsed }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Handle file selection from input
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // Process file upload and parsing
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("http://localhost:5000/api/parse-doc", formData);
      onFileParsed(response.data);
    } catch (error) {
      console.error("Error uploading file:", error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Grid2 container spacing={3} direction="column" alignItems="center" justifyContent="center">
        {/* Upload section title */}
        <Grid2 item>
          <Typography variant="h5" sx={{ color: "white", textAlign: "center" }}>
            Upload Document
          </Typography>
        </Grid2>

        {/* File input field */}
        <Grid2 item>
          <input
            type="file"
            onChange={handleFileChange}
            style={{
              marginBottom: "15px",
              color: "white",
              textAlign: "center",
              display: "block",
            }}
          />
        </Grid2>

        {/* Upload and parse button */}
        <Grid2 item>
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            disabled={uploading}
            sx={{ width: "200px" }}
          >
            {uploading ? "Uploading..." : "Upload & Parse"}
          </Button>
        </Grid2>
      </Grid2>
    </Container>
  );
}

export default FileUpload;
