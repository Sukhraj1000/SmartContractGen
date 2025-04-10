import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Typography,
  Container,
  CircularProgress,
  Grid,
  Box,
  Paper,
  Card,
  CardContent,
  useTheme
} from "@mui/material";
import { motion } from "framer-motion";
import { RocketLaunch, UploadFile } from "@mui/icons-material";
import "../styles/global.css"; 

/**
 * Home page component that serves as the main entry point for the application.
 * Provides navigation options for creating new contracts.
 * */
const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();

  // Handle navigation with loading animation
  const handleNavigation = (path) => {
    setLoading(true);
    setTimeout(() => {
      navigate(path);
    }, 600);
  };

  return (
    <Container
      maxWidth="xl"
      sx={{
        height: "100vh", 
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: "20px",
      }}
    >
      {/* Animated content container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        style={{ width: '100%', maxWidth: 1000 }}
      >
        {/* Main content paper with blur effect */}
        <Paper 
          elevation={4} 
          sx={{ 
            py: 6, 
            px: 4, 
            borderRadius: 3,
            background: 'rgba(29, 38, 48, 0.75)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <Grid container spacing={4} direction="column" alignItems="center">
            {/* Header */}
            <Grid item>
              <Typography variant="h2" fontWeight="bold" gutterBottom>
                Solana Smart Contract Generator
              </Typography>
              <Typography variant="h5" sx={{ maxWidth: "800px", margin: "auto", mb: 4, opacity: 0.9 }}>
                Create and deploy Solana smart contracts easily with AI-automation.
              </Typography>
            </Grid>

            {/* Action buttons */}
            <Grid item container spacing={4} justifyContent="center" sx={{ maxWidth: "800px" }}>
              {loading ? (
                /* Loading indicator */
                <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                  <CircularProgress size={60} />
                </Box>
              ) : (
                <>
                  {/* New contract button */}
                  <Grid item xs={20}>
                    <Card elevation={2} sx={{ height: '100%', borderRadius: 2, overflow: 'hidden' }}>
                      <CardContent sx={{ p: 0, height: '100%' }}>
                        <Button
                          variant="contained"
                          fullWidth
                          size="large"
                          startIcon={<RocketLaunch />}
                          sx={{
                            height: '100%',
                            py: 3,
                            borderRadius: 0,
                            fontSize: "1.2rem"
                          }}
                          onClick={() => handleNavigation("/contract-form")}
                        >
                          Start New Contract
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                </>
              )}
            </Grid>
          </Grid>
        </Paper>
      </motion.div>
    </Container>
  );
};

export default Home;
