import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Container, 
  Typography, 
  CircularProgress, 
  Alert, 
  Paper, 
  Box,
  useTheme
} from "@mui/material";
import axios from "axios";

const ContractProcessing = () => {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const theme = useTheme();

  useEffect(() => {
    const checkContractStatus = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/view-contract/${contractId}`);
        if (response.data.contract) {
          // Redirect to contract output page when ready
          navigate(`/contract/${contractId}`);
        }
      } catch (error) {
        console.error("Error checking contract status:", error);
        setError("Error fetching contract. Please try again.");
      }
    };

    // Poll every 5 seconds until contract is updated
    const interval = setInterval(checkContractStatus, 5000);
    return () => clearInterval(interval);
  }, [contractId, navigate]);

  return (
    <Container maxWidth="sm" sx={{ textAlign: "center", mt: 4 }}>
      <Paper 
        elevation={3} 
        sx={{ 
          p: 4, 
          borderRadius: 2, 
          background: 'rgba(29, 38, 48, 0.75)',
          backdropFilter: 'blur(10px)'
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 4 }}>
          Processing Your Smart Contract
        </Typography>
        
        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        ) : (
          <>
            <Box sx={{ mt: 4, mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress size={60} color="primary" sx={{ mb: 3 }} />
              <Typography variant="body1" sx={{ color: theme.palette.text.secondary, mt: 2 }}>
                AI is updating your contract. This may take a few minutes.
              </Typography>
            </Box>
          </>
        )}
      </Paper>
    </Container>
  );
};

export default ContractProcessing;
