import React, { useState } from "react";
import { Container, Grid, Typography, Button, MenuItem, Select, TextField } from "@mui/material";
import { useWizard } from "../../context/WizardContext";

const contractTemplates = {
  escrow: { contract_type: "escrow", contract_name: "", parties: { buyer: "", seller: "" }, parameters: { amount: 0, currency: "SOL", release_condition: "" } },
  token_vesting: { contract_type: "token_vesting", contract_name: "", beneficiary: "", total_tokens: 0, vesting_period: 0 },
  crowdfunding: { contract_type: "crowdfunding", contract_name: "", funding_goal: 0, deadline: "", contributors: [] },
  custom: { contract_type: "custom", contract_name: "", parameters: {} }
};

const StepOne = () => {
  const { setContractSchema, setCurrentStep } = useWizard();
  const [contractType, setContractType] = useState("");
  const [contractName, setContractName] = useState("");

  const handleNext = () => {
    if (!contractType || !contractName) return;
    setContractSchema({ ...contractTemplates[contractType], contract_name: contractName });
    setCurrentStep(2);
  };

  return (
    <Container maxWidth="sm" sx={{ display: "flex", flexDirection: "column", alignItems: "center", mt: 4 }}>
      <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 1: Contract Details</Typography>
      <TextField fullWidth label="Contract Name" variant="outlined" sx={{ mb: 2, backgroundColor: "white" }}
        value={contractName} onChange={(e) => setContractName(e.target.value)} />
      <Select fullWidth value={contractType} onChange={(e) => setContractType(e.target.value)}
        sx={{ backgroundColor: "white", mb: 3 }}>
        <MenuItem value="escrow">Escrow</MenuItem>
        <MenuItem value="token_vesting">Token Vesting</MenuItem>
        <MenuItem value="crowdfunding">Crowdfunding</MenuItem>
        <MenuItem value="custom">Custom Contract</MenuItem>
      </Select>
      <Button onClick={handleNext} variant="contained" disabled={!contractName || !contractType}>Next</Button>
    </Container>
  );
};

export default StepOne;
