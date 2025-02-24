import React, { useState } from "react";
import { Container, Grid2, Typography, Button, Select, MenuItem } from "@mui/material";
import { useWizard } from "../../context/WizardContext";

const StepOne = () => {
  const { setContractSchema, setCurrentStep } = useWizard();
  const [selectedType, setSelectedType] = useState("");

  const handleContractTypeChange = (event) => {
    const newType = event.target.value;
    setSelectedType(newType);

    // Reset contractSchema when contract type changes
    setContractSchema({
      contract_type: newType,
      contract_name: "",
      parameters: {},
      parties: {},
    });

    // Reset to step 1
    setCurrentStep(1);
  };

  return (
    <Container maxWidth="sm" sx={{ textAlign: "center", mt: 4 }}>
      <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Select Contract Type</Typography>
      <Select
        fullWidth
        value={selectedType}
        onChange={handleContractTypeChange}
        sx={{ backgroundColor: "white", mb: 3 }}
      >
        <MenuItem value="escrow">Escrow</MenuItem>
        <MenuItem value="token_vesting">Token Vesting</MenuItem>
        <MenuItem value="crowdfunding">Crowdfunding</MenuItem>
        <MenuItem value="custom">Custom</MenuItem>
      </Select>
      <Button variant="contained" disabled={!selectedType} onClick={() => setCurrentStep(2)}>
        Next
      </Button>
    </Container>
  );
};

export default StepOne;
