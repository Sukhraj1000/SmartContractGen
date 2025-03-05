import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Container, Typography, CircularProgress, Alert } from "@mui/material";
import axios from "axios";

const ContractProcessing = () => {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

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
      <Typography variant="h4" sx={{ color: "white", mb: 3 }}>
        Processing Your Smart Contract
      </Typography>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <Typography sx={{ color: "gray", mb: 2 }}>
            AI is updating your contract. This may take a few minutes.
          </Typography>
          <CircularProgress color="inherit" />
        </>
      )}
    </Container>
  );
};

export default ContractProcessing;
