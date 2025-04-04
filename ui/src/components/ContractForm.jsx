import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper,
  Divider,
} from '@mui/material';
import ContractPreview from './ContractPreview';

const ContractForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    contract_type: '',
    contract_name: '',
    parameters: {},
    parties: {}
  });

  const [isComplete, setIsComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Contract type configurations - matching ContractPreview exactly
  const fieldConfigs = {
    escrow: {
      title: 'Escrow Contract',
      description: 'Create a secure escrow contract for holding and releasing funds based on conditions.',
      parties: [
        { key: 'buyer', label: 'Buyer', required: true },
        { key: 'seller', label: 'Seller', required: true },
        { key: 'escrow_authority', label: 'Escrow Authority', required: true }
      ],
      parameters: [
        { key: 'amount', label: 'Amount', type: 'number', required: true },
        { key: 'currency', label: 'Currency', type: 'select', required: true, options: ['SOL', 'USDC'] },
        { key: 'release_condition', label: 'Release Condition', type: 'text', required: true }
      ]
    },
    crowdfunding: {
      title: 'Crowdfunding Contract',
      description: 'Create a crowdfunding campaign with funding goals and deadlines.',
      parties: [
        { key: 'creator', label: 'Campaign Creator', required: true },
        { key: 'beneficiary', label: 'Beneficiary', required: true }
      ],
      parameters: [
        { key: 'campaign_name', label: 'Campaign Name', type: 'text', required: true },
        { key: 'description', label: 'Description', type: 'text', required: true },
        { key: 'funding_goal', label: 'Funding Goal', type: 'number', required: true },
        { key: 'deadline', label: 'Campaign Deadline (YYYY-MM-DD)', type: 'date', required: true }
      ]
    }
  };

  // Handle contract type selection change
  const handleContractTypeChange = (event) => {
    const newType = event.target.value;
    setFormData({
      contract_type: newType,
      contract_name: '',
      parameters: {},
      parties: {}
    });
  };

  // Handle party information updates
  const handlePartyChange = (partyKey, value) => {
    setFormData(prev => ({
      ...prev,
      parties: {
        ...prev.parties,
        [partyKey]: value
      }
    }));
  };

  // Handle parameter value updates
  const handleParameterChange = (paramKey, value) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [paramKey]: value
      }
    }));
  };

  // Validate form completion status
  useEffect(() => {
    if (!formData.contract_type || !formData.contract_name) {
      setIsComplete(false);
      return;
    }

    const config = fieldConfigs[formData.contract_type];
    if (!config) {
      setIsComplete(false);
      return;
    }

    // Verify all required parties are specified
    const hasAllParties = config.parties.every(party => 
      party.required ? !!formData.parties[party.key] : true
    );

    // Verify all required parameters are specified
    const hasAllParams = config.parameters.every(param => 
      param.required ? !!formData.parameters[param.key] : true
    );

    setIsComplete(hasAllParties && hasAllParams);
  }, [formData]);

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isComplete || submitting) return;

    setSubmitting(true);
    try {
      const response = await fetch('http://localhost:8000/api/build-contract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          max_attempts: 3
        }),
      });

      const data = await response.json();
      if (data.error) {
        console.error('Error:', data.error);
        return;
      }

      // Navigate to processing page with the contract ID
      navigate(`/processing/${data.contract_id}`);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const currentConfig = fieldConfigs[formData.contract_type];

  return (
    <Box sx={{ 
      maxWidth: 1200, 
      mx: 'auto', 
      p: 3,
      backgroundColor: '#1a2027',
      minHeight: '100vh',
      color: 'white'
    }}>
      <Typography variant="h2" component="h1" gutterBottom sx={{ color: 'white', mb: 4 }}>
        Create Smart Contract
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={7}>
          <Paper 
            component="form" 
            onSubmit={handleSubmit} 
            sx={{ 
              p: 3, 
              backgroundColor: '#22272e',
              color: 'white',
              borderRadius: 2
            }}
          >
            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Contract Type</InputLabel>
              <Select
                value={formData.contract_type}
                label="Contract Type"
                onChange={handleContractTypeChange}
                required
                sx={{
                  color: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.23)',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'rgba(255, 255, 255, 0.23)',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: 'primary.main',
                  }
                }}
              >
                <MenuItem value="">Select a contract type</MenuItem>
                {Object.keys(fieldConfigs).map(type => (
                  <MenuItem key={type} value={type}>
                    {fieldConfigs[type].title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {currentConfig && (
              <>
                <Typography variant="h6" gutterBottom>
                  {currentConfig.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }} paragraph>
                  {currentConfig.description}
                </Typography>

                <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.12)' }} />

                <Typography variant="h6" gutterBottom>
                  Contract Details
                </Typography>
                <TextField
                  fullWidth
                  label="Contract Name"
                  value={formData.contract_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contract_name: e.target.value }))}
                  required
                  sx={{ 
                    mb: 3,
                    input: { color: 'white' },
                    label: { color: 'rgba(255, 255, 255, 0.7)' },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.23)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(255, 255, 255, 0.23)',
                    }
                  }}
                />

                <Typography variant="h6" gutterBottom>
                  Parties
                </Typography>
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  {currentConfig.parties.map(party => (
                    <Grid item xs={12} sm={6} key={party.key}>
                      <TextField
                        fullWidth
                        label={party.label}
                        value={formData.parties[party.key] || ''}
                        onChange={(e) => handlePartyChange(party.key, e.target.value)}
                        required={party.required}
                        sx={{ 
                          input: { color: 'white' },
                          label: { color: 'rgba(255, 255, 255, 0.7)' },
                          '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.23)',
                          },
                          '&:hover .MuiOutlinedInput-notchedOutline': {
                            borderColor: 'rgba(255, 255, 255, 0.23)',
                          }
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>

                <Typography variant="h6" gutterBottom>
                  Parameters
                </Typography>
                <Grid container spacing={2}>
                  {currentConfig.parameters.map(param => (
                    <Grid item xs={12} sm={6} key={param.key}>
                      {param.type === 'select' ? (
                        <FormControl fullWidth>
                          <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{param.label}</InputLabel>
                          <Select
                            value={formData.parameters[param.key] || ''}
                            label={param.label}
                            onChange={(e) => handleParameterChange(param.key, e.target.value)}
                            required={param.required}
                            sx={{
                              color: 'white',
                              '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: 'rgba(255, 255, 255, 0.23)',
                              }
                            }}
                          >
                            {param.options.map(option => (
                              <MenuItem key={option} value={option}>
                                {option}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      ) : (
                        <TextField
                          fullWidth
                          label={param.label}
                          type={param.type === 'number' ? 'number' : param.type === 'date' ? 'date' : 'text'}
                          value={formData.parameters[param.key] || ''}
                          onChange={(e) => handleParameterChange(param.key, e.target.value)}
                          required={param.required}
                          InputLabelProps={{
                            shrink: true,
                            sx: { color: 'rgba(255, 255, 255, 0.7)' }
                          }}
                          sx={{ 
                            input: { color: 'white' },
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255, 255, 255, 0.23)',
                            }
                          }}
                        />
                      )}
                    </Grid>
                  ))}
                </Grid>

                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={!isComplete || submitting}
                    sx={{
                      bgcolor: '#4f46e5',
                      '&:hover': {
                        bgcolor: '#4338ca',
                      },
                      '&.Mui-disabled': {
                        bgcolor: 'rgba(79, 70, 229, 0.5)',
                      }
                    }}
                  >
                    {submitting ? 'Generating...' : 'Generate Contract'}
                  </Button>
                </Box>
              </>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={5}>
          <ContractPreview
            contractType={formData.contract_type}
            formData={formData}
            fieldConfigs={fieldConfigs}
            isComplete={isComplete}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default ContractForm; 