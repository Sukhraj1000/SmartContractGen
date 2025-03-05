import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Typography, CircularProgress, Alert } from "@mui/material";
import axios from "axios";

const ContractProcessing = () => {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(true);

  useEffect(() => {
    const checkContractStatus = async () => {
      try {
        const response = await axios.get(`http://localhost:8000/api/view-contract/${contractId}`);
        
        if (response.status === 200 && response.data.contract) {
          setPolling(false);
          navigate(`/contract/${contractId}`);
        }
      } catch (error) {
        console.error("Error checking contract status:", error);
        setError("Error fetching contract. Please try again.");
      }
    };

    if (polling) {
      const interval = setInterval(checkContractStatus, 5000); // Poll every 5 seconds
      return () => clearInterval(interval); 
    }
  }, [contractId, navigate, polling]);

  return (
    <Container maxWidth="sm" sx={{ textAlign: "center", mt: 4 }}>
      <Typography variant="h4" sx={{ color: "white", mb: 3 }}>
        Processing Your Smart Contract
      </Typography>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <Typography sx={{ color: "gray", mb: 2 }}>
            This may take a few minutes. Please wait while both AI models process your contract.
          </Typography>
          <CircularProgress color="inherit" />
        </>
      )}
    </Container>
  );
};

export default ContractProcessing;
