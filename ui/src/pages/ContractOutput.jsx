import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { 
  Container, Typography, Paper, Button, CircularProgress, Box, Alert, Tooltip,
  Card, CardContent, Divider, useTheme
} from "@mui/material";
import { ContentCopy, Download } from "@mui/icons-material";
import axios from "axios";

const ContractOutput = () => {
  const { contractId } = useParams();
  const [contract, setContract] = useState("");
  const [contractName, setContractName] = useState("");
  const [contractType, setContractType] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    const fetchContract = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/view-contract/${contractId}`);
        if (response.status === 200 && response.data.contract) {
          setContract(response.data.contract);
          setContractName(response.data.name || "Unnamed Contract");
          setContractType(response.data.type || "unknown");
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

  const handleDownload = () => {
    if (contract) {
      const blob = new Blob([contract], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `${contractName.replace(/\s+/g, "_")}.rs`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getContractTypeTitle = (type) => {
    switch (type) {
      case "escrow":
        return "Escrow Contract";
      case "token_vesting":
        return "Token Vesting Contract";
      case "crowdfunding":
        return "Crowdfunding Contract";
      case "custom":
        return "Custom Contract";
      default:
        return "Smart Contract";
    }
  };

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ textAlign: "center", mt: 8 }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading your contract...</Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          Error loading contract. Please try again or contact support.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ pb: 6 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2, mb: 4, background: 'rgba(29, 38, 48, 0.75)' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', color: theme.palette.primary.light }}>
          {contractName}
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 3, color: 'text.secondary' }}>
          {getContractTypeTitle(contractType)}
        </Typography>
        
        <Divider sx={{ mb: 3 }} />
        
        <Card elevation={2} sx={{ mb: 3 }}>
          <CardContent sx={{ p: 0 }}>
            <Box
              component="pre"
              sx={{
                p: 2,
                overflowX: "auto",
                fontSize: "0.9rem",
                fontFamily: "'JetBrains Mono', monospace",
                backgroundColor: "#1e2329",
                color: "#e6e6e6",
                borderRadius: "4px",
                maxHeight: "500px",
                overflowY: "auto",
                "&::-webkit-scrollbar": {
                  width: "8px",
                  height: "8px",
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "rgba(255,255,255,0.3)",
                  borderRadius: "4px",
                },
              }}
            >
              {contract}
            </Box>
          </CardContent>
        </Card>
        
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 3 }}>
          <Tooltip title={copied ? "Copied!" : "Copy to clipboard"} arrow>
            <Button
              variant="outlined"
              color={copied ? "success" : "primary"}
              startIcon={<ContentCopy />}
              onClick={handleCopyToClipboard}
              sx={{ borderRadius: '8px' }}
            >
              {copied ? "Copied!" : "Copy Code"}
            </Button>
          </Tooltip>
          
          <Button
            variant="contained"
            color="primary"
            startIcon={<Download />}
            onClick={handleDownload}
            sx={{ borderRadius: '8px' }}
          >
            Download Contract
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default ContractOutput;
