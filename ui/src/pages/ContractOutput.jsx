import React, { useEffect, useState } from "react";
import axios from "axios";
import { useParams } from "react-router-dom";
import { Container, Typography, Paper, Button, CircularProgress, Box } from "@mui/material";
import { ContentCopy, Download } from "@mui/icons-material";

const ContractOutput = () => {
  const { contractId } = useParams();
  const [contract, setContract] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/view-contract/${contractId}`);
        setContract(response.data.contract);
      } catch (error) {
        console.error("Error fetching contract:", error);
      }
      setLoading(false);
    };

    fetchContract();
  }, [contractId]);

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(contract);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset copied state after 2 seconds
  };

  return (
    <Container maxWidth="md" sx={{ textAlign: "center", mt: 4 }}>
      <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Generated Smart Contract</Typography>

      {loading ? (
        <CircularProgress color="inherit" sx={{ mt: 2 }} />
      ) : (
        <Paper sx={{ 
          padding: 3, 
          backgroundColor: "#222", 
          color: "white", 
          mb: 3, 
          borderRadius: 2, 
          overflowX: "auto", 
          boxShadow: 3
        }}>
          <Typography variant="h6" sx={{ color: "yellow", mb: 2 }}>Smart Contract Code:</Typography>
          
          <Box
            sx={{
              backgroundColor: "#111", 
              padding: 2, 
              borderRadius: 2, 
              overflowX: "auto", 
              maxHeight: "800px", 
              textAlign: "left", 
              fontFamily: "monospace",
              fontSize: "0.95rem",
              lineHeight: "1.5",
              whiteSpace: "pre-wrap"
            }}
          >
            {contract}
          </Box>

          {/* Copy & Download Buttons */}
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 3 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleCopyToClipboard} 
              startIcon={<ContentCopy />}
            >
              {copied ? "Copied!" : "Copy to Clipboard"}
            </Button>

            <Button 
              variant="contained" 
              color="success" 
              href={`/download/${contractId}`} 
              startIcon={<Download />}
            >
              Download Contract
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default ContractOutput;
