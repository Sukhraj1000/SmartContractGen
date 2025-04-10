import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import Home from "./pages/Home";
import ContractForm from "./components/ContractForm";
import ContractOutput from "./pages/ContractOutput";
import ContractProcessing from "./pages/ContractProcessing";
import NavBar from "./components/NavBar";
import { CssBaseline, Container } from "@mui/material";
import theme from "./theme";

// Navigation wrapper that displays NavBar on all pages except home
const NavigationWrapper = ({ children }) => {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  
  return (
    <>
      {!isHomePage && <NavBar />}
      <Container sx={{ mt: isHomePage ? 0 : 4 }}>
        {children}
      </Container>
    </>
  );
};

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={
            <NavigationWrapper>
              <Home />
            </NavigationWrapper>
          } />
          <Route path="/contract-form" element={
            <NavigationWrapper>
              <ContractForm />
            </NavigationWrapper>
          } />
          <Route path="/contract/:contractId" element={
            <NavigationWrapper>
              <ContractOutput />
            </NavigationWrapper>
          } />
          <Route path="/processing/:contractId" element={
            <NavigationWrapper>
              <ContractProcessing />
            </NavigationWrapper>
          } />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
