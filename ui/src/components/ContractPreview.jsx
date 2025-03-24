import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  Chip,
  useTheme,
  alpha,
  Alert
} from '@mui/material';
import {
  InfoOutlined,
  ExpandMore,
  Code,
  Description,
  ErrorOutline
} from '@mui/icons-material';

const ContractPreview = ({ contractType, formData, fieldConfigs, isComplete }) => {
  const [showJson, setShowJson] = useState(false);
  const theme = useTheme();

  if (!contractType || !fieldConfigs[contractType]) {
    return null;
  }

  const config = fieldConfigs[contractType];

  // Prepare JSON preview
  const jsonData = {
    contract_type: contractType,
    contract_name: formData.contract_name || "[Contract Name]",
    parameters: formData.parameters || {},
    parties: formData.parties || {}
  };

  // Helper to format JSON with indentation
  const formatJson = (obj) => {
    return JSON.stringify(obj, null, 2);
  };

  // Helper function to explain each parameter
  const getParameterExplanation = (key) => {
    const explanations = {
      // Escrow parameters
      amount: "The amount of tokens/currency to be held in escrow",
      currency: "The currency type to be used (SOL or other tokens)",
      release_condition: "Conditions that must be met to release the funds",

      // Token vesting parameters
      token_mint: "The token mint address for the token to be vested",
      total_amount: "Total amount of tokens to be vested",
      vesting_duration: "Total duration of the vesting period in days",
      cliff_period: "Time before tokens begin to vest (in days)",

      // Crowdfunding parameters
      campaign_name: "Name of the crowdfunding campaign",
      description: "Detailed description of the campaign",
      funding_goal: "Target amount to be raised",
      deadline: "Number of days the campaign will run for",
      
      // Custom parameters
      custom_description: "Detailed description of custom contract requirements",
      functionality: "Specific functionality the contract should implement"
    };

    return explanations[key] || "Parameter for the smart contract";
  };

  // Helper function to explain each party role
  const getPartyExplanation = (key) => {
    const explanations = {
      buyer: "Party who pays funds into the escrow",
      seller: "Party who receives funds after conditions are met",
      owner: "Party who creates and administers the contract",
      beneficiary: "Party who receives tokens according to vesting schedule",
      creator: "Party who creates and manages the crowdfunding campaign"
    };

    return explanations[key] || "Participant in the smart contract";
  };

  // Find missing required fields
  const getMissingRequiredFields = () => {
    const missingFields = [];
    
    if (!formData.contract_name) {
      missingFields.push("Contract Name");
    }
    
    config.parties.forEach(party => {
      if (party.required && !formData.parties[party.key]) {
        missingFields.push(party.label);
      }
    });
    
    config.parameters.forEach(param => {
      if (param.required && !formData.parameters[param.key]) {
        missingFields.push(param.label);
      }
    });
    
    return missingFields;
  };

  const missingFields = getMissingRequiredFields();

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 3, 
        mt: 4, 
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
        backgroundColor: alpha(theme.palette.background.paper, 0.7)
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center">
          <Description color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" color="primary">
            Contract Preview
          </Typography>
        </Box>
        <Tooltip title={showJson ? "Hide JSON data" : "View JSON data sent to AI"}>
          <Box 
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: showJson ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
              borderRadius: 2,
              padding: '4px 10px',
              border: `1px solid ${showJson ? theme.palette.primary.main : 'transparent'}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.2),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.5)}`
              }
            }}
            onClick={() => setShowJson(!showJson)}
          >
            <Code 
              color={showJson ? "primary" : "action"} 
              fontSize="small" 
              sx={{ mr: 0.5 }} 
            />
            <Typography 
              variant="caption" 
              color={showJson ? "primary" : "text.secondary"}
              sx={{ fontWeight: showJson ? 'medium' : 'regular' }}
            >
              {showJson ? "Hide JSON" : "View JSON"}
            </Typography>
          </Box>
        </Tooltip>
      </Box>
      
      <Divider sx={{ mb: 2 }} />

      {!isComplete && (
        <Alert 
          severity="info" 
          icon={<ErrorOutline />}
          sx={{ mb: 2 }}
        >
          Complete all required fields to finalize contract details.
          {missingFields.length > 0 && (
            <Typography variant="body2" component="div" sx={{ mt: 1 }}>
              Missing fields: {missingFields.join(", ")}
            </Typography>
          )}
        </Alert>
      )}

      {showJson ? (
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            JSON Sent to AI:
          </Typography>
          <Box 
            component="pre" 
            sx={{ 
              p: 2, 
              borderRadius: 1, 
              backgroundColor: 'background.default',
              overflow: 'auto',
              fontSize: '0.875rem',
              maxHeight: '400px',
              border: `1px solid ${alpha(theme.palette.divider, 0.3)}`
            }}
          >
            {formatJson(jsonData)}
          </Box>
        </Box>
      ) : (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            {config.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {config.description}
          </Typography>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box display="flex" alignItems="center">
                <InfoOutlined fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                <Typography>What Do These Inputs Mean?</Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box mb={3}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  Contract Parties:
                </Typography>
                <List dense disablePadding>
                  {config.parties.map((party) => (
                    <ListItem key={party.key} sx={{ py: 0.5 }}>
                      <ListItemText 
                        primary={
                          <Box display="flex" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              {party.label}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={party.key} 
                              sx={{ ml: 1, fontSize: '0.7rem' }} 
                              color="primary" 
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={getPartyExplanation(party.key)}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  Contract Parameters:
                </Typography>
                <List dense disablePadding>
                  {config.parameters.map((param) => (
                    <ListItem key={param.key} sx={{ py: 0.5 }}>
                      <ListItemText 
                        primary={
                          <Box display="flex" alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                              {param.label}
                            </Typography>
                            <Chip 
                              size="small" 
                              label={param.key} 
                              sx={{ ml: 1, fontSize: '0.7rem' }} 
                              color="secondary" 
                              variant="outlined"
                            />
                            {param.type && param.type !== "text" && (
                              <Chip 
                                size="small" 
                                label={param.type} 
                                sx={{ ml: 1, fontSize: '0.7rem' }} 
                                color="info" 
                                variant="outlined"
                              />
                            )}
                          </Box>
                        }
                        secondary={getParameterExplanation(param.key)}
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}
    </Paper>
  );
};

export default ContractPreview; 