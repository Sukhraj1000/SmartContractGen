import React, { useState } from "react";
import axios from "axios";
import { Button, Box, Typography, Grid2, Container } from "@mui/material";

function FileUpload({ onFileParsed }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

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
        <Grid2 item>
          <Typography variant="h5" sx={{ color: "white", textAlign: "center" }}>
            Upload Document
          </Typography>
        </Grid2>

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
