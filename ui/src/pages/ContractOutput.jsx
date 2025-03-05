import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { 
  Container, Typography, Paper, Button, CircularProgress, Box, Alert, Tooltip 
} from "@mui/material";
import { ContentCopy, Download } from "@mui/icons-material";
import axios from "axios";

const ContractOutput = () => {
  const { contractId } = useParams();
  const [contract, setContract] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/view-contract/${contractId}`);
        if (response.status === 200 && response.data.contract) {
          setContract(response.data.contract);
        } else {
          setError(true);
        }
      } catch (error) {
        console.error("Error fetching contract:", error);
        setError(true);
      }
      setLoading(false);
    };

    fetchContract();
  }, [contractId]);

  const handleCopyToClipboard = () => {
    if (contract) {
      navigator.clipboard.writeText(contract);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Container maxWidth="md" sx={{ textAlign: "center", mt: 4 }}>
      <Typography variant="h4" sx={{ color: "white", mb: 3 }}>
        Generated Smart Contract
      </Typography>

      {loading ? (
        <CircularProgress color="inherit" sx={{ mt: 2 }} />
      ) : error ? (
        <Alert severity="error" sx={{ mt: 3 }}>
          Error fetching contract. Please try again.
        </Alert>
      ) : (
        <Paper sx={{ padding: 3, backgroundColor: "#222", color: "white", mb: 3, borderRadius: 2, overflowX: "auto", boxShadow: 3 }}>
          <Typography variant="h6" sx={{ color: "yellow", mb: 2 }}>
            Smart Contract Code:
          </Typography>
          
          <Box sx={{ backgroundColor: "#111", padding: 2, borderRadius: 2, overflowX: "auto", maxHeight: "800px", textAlign: "left", fontFamily: "monospace", fontSize: "0.95rem", lineHeight: "1.5", whiteSpace: "pre-wrap" }}>
            {contract}
          </Box>

          <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 3 }}>
            <Tooltip title="Copy contract code to clipboard">
              <Button variant="contained" color="primary" onClick={handleCopyToClipboard} startIcon={<ContentCopy />} disabled={copied}>
                {copied ? "Copied!" : "Copy to Clipboard"}
              </Button>
            </Tooltip>

            <Tooltip title="Download the contract file">
              <Button 
                variant="contained" 
                color="success" 
                href={contractId ? `http://localhost:8000/api/download-contract/${contractId}` : "#"}
                startIcon={<Download />} 
                target="_blank"
                disabled={!contractId}
              >
                {contractId ? "Download Contract" : "Generating..."}
              </Button>
            </Tooltip>
          </Box>
        </Paper>
      )}
    </Container>
  );
};

export default ContractOutput;
