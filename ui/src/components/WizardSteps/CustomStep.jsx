import React, { useState } from "react";
import { Container, Grid, Typography, Button, TextField, Paper, IconButton } from "@mui/material";
import { useWizard } from "../../context/WizardContext";
import DeleteIcon from "@mui/icons-material/Delete";

const CustomStep = () => {
  const { contractSchema, setContractSchema, setCurrentStep } = useWizard();
  const [step, setStep] = useState(1);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");

  // Update contract schema fields (e.g., contract_name, contract_type)
  const handleContractChange = (key, value) => {
    setContractSchema((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  // Add new key-value pair to parameters
  const handleAddParameter = () => {
    if (newKey.trim() === "" || newValue.trim() === "") return;

    setContractSchema((prev) => ({
      ...prev,
      parameters: { ...prev.parameters, [newKey]: newValue }
    }));

    // Clear input fields
    setNewKey("");
    setNewValue("");
  };

  // Remove a key-value pair
  const handleRemoveParameter = (key) => {
    const updatedParams = { ...contractSchema.parameters };
    delete updatedParams[key];

    setContractSchema((prev) => ({
      ...prev,
      parameters: updatedParams
    }));
  };

  return (
    <Container maxWidth="sm" sx={{ textAlign: "center", mt: 4 }}>
      {step === 1 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 2: Custom Contract Details</Typography>
          <TextField 
            fullWidth 
            label="Contract Name" 
            sx={{ mb: 2, backgroundColor: "white" }} 
            value={contractSchema.contract_name || ""}
            onChange={(e) => handleContractChange("contract_name", e.target.value)}
          />
          <Grid container justifyContent="space-between">
            <Button variant="outlined" onClick={() => setCurrentStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(2)} disabled={!contractSchema.contract_name}>
              Next
            </Button>
          </Grid>
        </>
      )}

      {step === 2 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 3: Add Custom Fields</Typography>
          <TextField 
            fullWidth 
            label="Key" 
            sx={{ mb: 2, backgroundColor: "white" }} 
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <TextField 
            fullWidth 
            label="Value" 
            sx={{ mb: 2, backgroundColor: "white" }} 
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />
          <Button 
            variant="contained" 
            onClick={handleAddParameter} 
            sx={{ mb: 3 }}
            disabled={newKey.trim() === "" || newValue.trim() === ""}
          >
            Add Field
          </Button>

          {/* Display all added key-value pairs */}
          {contractSchema.parameters && Object.keys(contractSchema.parameters).length > 0 && (
            <Paper sx={{ padding: 2, textAlign: "left", backgroundColor: "#333", color: "white", width: "100%", mb: 2 }}>
              <Typography variant="h6" sx={{ color: "yellow", mb: 2 }}>Added Fields:</Typography>
              {Object.entries(contractSchema.parameters).map(([key, value]) => (
                <Grid container key={key} justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography>{key}: {value}</Typography>
                  <IconButton onClick={() => handleRemoveParameter(key)} sx={{ color: "red" }}>
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              ))}
            </Paper>
          )}

          <Grid container justifyContent="space-between">
            <Button variant="outlined" onClick={() => setStep(1)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(3)} disabled={Object.keys(contractSchema.parameters || {}).length === 0}>
              Next
            </Button>
          </Grid>
        </>
      )}

      {step === 3 && (
        <>
          <Typography variant="h4" sx={{ color: "white", mb: 3 }}>Step 4: Review & JSON Summary</Typography>
          <Paper sx={{ padding: 2, textAlign: "left", backgroundColor: "#333", color: "white", width: "100%" }}>
            <pre>{JSON.stringify(contractSchema, null, 2)}</pre>
          </Paper>
          <Grid container justifyContent="space-between" sx={{ mt: 3 }}>
            <Button variant="outlined" onClick={() => setStep(2)}>Back</Button>
            <Button variant="contained" color="success" onClick={() => console.log("Contract Submitted:", contractSchema)}>
              Submit Contract
            </Button>
          </Grid>
        </>
      )}
    </Container>
  );
};

export default CustomStep;
