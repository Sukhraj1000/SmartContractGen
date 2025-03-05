import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Typography,
  Container,
  CircularProgress,
  Grid2,
} from "@mui/material";
import { motion } from "framer-motion";
import { RocketLaunch, UploadFile } from "@mui/icons-material";
import "../styles/global.css"; 


const Home = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleNavigation = (path) => {
    setLoading(true);
    setTimeout(() => {
      navigate(path);
    }, 1000);
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
        color: "white",
        padding: "20px",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <Grid2 container spacing={3} direction="column" alignItems="center">
          <Grid2 item>
            <Typography variant="h2" fontWeight="bold" gutterBottom>
              Solana Smart Contract Generator
            </Typography>
            <Typography variant="h4" sx={{ maxWidth: "800px", margin: "auto", mb: 1 }}>
              Create and deploy Solana smart contracts easily with AI-automation.
            </Typography>
            <Typography variant="h6" sx={{ maxWidth: "700px", margin: "auto", mb: 2 }}>
                Either start a new Smart Contract and Manually input data or upload a document to fast track the process.
            </Typography>
          </Grid2>

          <Grid2 item container spacing={3} justifyContent="center" sx={{ maxWidth: "600px" }}>
            {loading ? (
              <CircularProgress color="inherit" />
            ) : (
              <>
                <Grid2 item xs={12} sm={6}>
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    startIcon={<RocketLaunch />}
                    sx={{
                      backgroundColor: "#ff9800",
                      "&:hover": { backgroundColor: "#f57c00" },
                      fontSize: "1.1rem",
                      padding: "12px",
                    }}
                    onClick={() => handleNavigation("/wizard")}
                  >
                    Start New Contract
                  </Button>
                </Grid2>

                <Grid2 item xs={12} sm={6}>
                  <Button
                    variant="outlined"
                    fullWidth
                    size="large"
                    startIcon={<UploadFile />}
                    sx={{
                      borderColor: "white",
                      color: "white",
                      fontSize: "1.1rem",
                      padding: "12px",
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255,0.2)",
                      },
                    }}
                    onClick={() => handleNavigation("/upload")}
                  >
                    Upload Document
                  </Button>
                </Grid2>
              </>
            )}
          </Grid2>

          <Grid2 item mt={6}>
            <Typography variant="body1">
              Help?{" "}
              <a
                href="/docs"
                style={{
                  color: "yellow",
                  textDecoration: "none",
                  fontWeight: "bold",
                }}
              >
                View Documentation
              </a>
            </Typography>
          </Grid2>
        </Grid2>
      </motion.div>
    </Container>
  );
};

export default Home;
