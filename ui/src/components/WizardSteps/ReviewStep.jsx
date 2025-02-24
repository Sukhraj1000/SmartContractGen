import React, { useState, useEffect } from "react";
import { Container, Typography, Paper, Button, Grid2 } from "@mui/material";
import { useWizard } from "../../context/WizardContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";


const ReviewStep = () => {
  const { contractSchema, setCurrentStep } = useWizard();
  const [showJSON, setShowJSON] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();


  const handleSubmit = async () => {
    setLoading(true);

    try {
      const response = await axios.post("http://localhost:8000/api/generate-contract", contractSchema);
      const contractId = response.data.contract_id;

      // Redirect to contract output page
      navigate(`/contract/${contractId}`);
    } catch (error) {
      console.error("Error submitting contract:", error);
    }

    setLoading(false);
  };

  return (
    <Container maxWidth="sm" sx={{ textAlign: "center", mt: 4 }}>
      <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Final Review of Your Smart Contract</Typography>

      {/* Contract Overview */}
      <Paper sx={{ padding: 3, textAlign: "left", backgroundColor: "#333", color: "white", width: "100%", mb: 2 }}>
        <Typography variant="h6" sx={{ color: "yellow", mb: 1 }}>General Contract Information</Typography>
        <Typography><strong>Contract Type:</strong> {contractSchema.contract_type?.replace("_", " ") || "Not specified"}</Typography>
        <Typography><strong>Contract Name:</strong> {contractSchema.contract_name || "Not specified"}</Typography>

        {/* Escrow Contract Explanation */}
        {contractSchema.contract_type === "escrow" && contractSchema.parties && (
          <>
            <Typography variant="h6" sx={{ color: "yellow", mt: 2 }}>Parties Involved</Typography>
            <Typography><strong>Buyer (Paying Party):</strong> {contractSchema.parties.buyer || "Not specified"}</Typography>
            <Typography><strong>Seller (Receiving Party):</strong> {contractSchema.parties.seller || "Not specified"}</Typography>

            <Typography variant="h6" sx={{ color: "yellow", mt: 2 }}>Escrow Terms</Typography>
            <Typography>
              <strong>Escrow Amount:</strong> {contractSchema.parameters?.amount || "Not specified"} {contractSchema.parameters?.currency || ""}
            </Typography>
            <Typography>
              <strong>Funds will be released when:</strong> {contractSchema.parameters?.release_condition || "Not specified"}
            </Typography>
            <Typography sx={{ fontStyle: "italic", mt: 1 }}>
              An escrow contract holds funds securely until a predefined condition is met.
            </Typography>
          </>
        )}

        {/* Token Vesting Explanation */}
        {contractSchema.contract_type === "token_vesting" && contractSchema.parameters && (
          <>
            <Typography variant="h6" sx={{ color: "yellow", mt: 2 }}>Token Vesting Details</Typography>
            <Typography><strong>Beneficiary (Receiving Tokens):</strong> {contractSchema.parameters.beneficiary || "Not specified"}</Typography>
            <Typography><strong>Total Tokens Allocated:</strong> {contractSchema.parameters.total_tokens || "Not specified"}</Typography>
            <Typography>
              <strong>Tokens will be gradually released over:</strong> {contractSchema.parameters.vesting_period || "Not specified"} months
            </Typography>
            <Typography sx={{ fontStyle: "italic", mt: 1 }}>
              Token vesting ensures tokens are distributed over time instead of all at once.
            </Typography>
          </>
        )}

        {/* Crowdfunding Explanation */}
        {contractSchema.contract_type === "crowdfunding" && contractSchema.parameters && (
          <>
            <Typography variant="h6" sx={{ color: "yellow", mt: 2 }}>Crowdfunding Details</Typography>
            <Typography><strong>Funding Goal:</strong> {contractSchema.parameters.funding_goal || "Not specified"} SOL</Typography>
            <Typography><strong>Deadline for Contributions:</strong> {contractSchema.parameters.deadline || "Not specified"}</Typography>
            <Typography sx={{ fontStyle: "italic", mt: 1 }}>
              Crowdfunding contracts allow multiple contributors to fund a project before a set deadline.
            </Typography>
          </>
        )}

        {/* Custom Contract Explanation */}
        {contractSchema.contract_type === "custom" && contractSchema.parameters && (
          <>
            <Typography variant="h6" sx={{ color: "yellow", mt: 2 }}>Custom Contract Fields</Typography>
            {Object.entries(contractSchema.parameters).map(([key, value]) => (
              <Typography key={key}><strong>{key}:</strong> {value}</Typography>
            ))}
            <Typography sx={{ fontStyle: "italic", mt: 1 }}>
              Custom contracts allow you to define your own rules and structure.
            </Typography>
          </>
        )}
      </Paper>

      {/* Toggle Button for JSON View */}
      <Button variant="outlined" sx={{ mb: 2 }} onClick={() => setShowJSON(!showJSON)}>
        {showJSON ? "Hide Technical JSON" : "Show Full JSON"
        }
      </Button>

      {/* Full JSON (For Advanced Users) */}
      {showJSON && (
        <Paper sx={{ padding: 2, textAlign: "left", backgroundColor: "#222", color: "white", width: "100%", mb: 2 }}>
          <pre>{JSON.stringify(contractSchema, null, 2)}</pre>
        </Paper>
      )}

      {/* Navigation Buttons */}
      <Grid2 container justifyContent="space-between" sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => navigate("/wizard")}>Back</Button>
        <Button 
          variant="contained" 
          color="success" 
          onClick={handleSubmit} 
          disabled={loading}
        >
          {loading ? "Submitting..." : "Submit Contract"}
        </Button>
      </Grid2>
    </Container>
  );
};

export default ReviewStep;
