import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  useMediaQuery,
  useTheme,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Home as HomeIcon,
  Add as AddIcon,
  Menu as MenuIcon
} from '@mui/icons-material';

/**
 * Navigation bar with responsive mobile menu
 */
const NavBar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = React.useState(null);
  
  // Open mobile menu
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  // Close mobile menu
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <AppBar 
      position="static" 
      elevation={0} 
      sx={{ 
        mb: 4,
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}
    >
      <Container>
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          {/* Application title with link to home page */}
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              color: theme.palette.primary.light,
              textDecoration: 'none',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Smart Contract Generator
          </Typography>
          
          {/* Responsive navigation menu */}
          {isMobile ? (
            <>
              {/* Mobile menu button */}
              <IconButton
                color="inherit"
                aria-label="menu"
                edge="end"
                onClick={handleMenuOpen}
              >
                <MenuIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                PaperProps={{
                  elevation: 3,
                  sx: { 
                    mt: 1.5,
                    background: 'rgba(29, 38, 48, 0.9)',
                    backdropFilter: 'blur(10px)'
                  }
                }}
              >
                <MenuItem 
                  component={RouterLink} 
                  to="/" 
                  onClick={handleMenuClose}
                >
                  Home
                </MenuItem>
                <MenuItem 
                  component={RouterLink} 
                  to="/contract-form" 
                  onClick={handleMenuClose}
                >
                  New Contract
                </MenuItem>
              </Menu>
            </>
          ) : (
            /* Desktop navigation buttons */
            <Box>
              <Button 
                color="inherit" 
                component={RouterLink} 
                to="/" 
                startIcon={<HomeIcon />}
                sx={{ mx: 1 }}
              >
                Home
              </Button>
              <Button 
                color="primary" 
                component={RouterLink} 
                to="/contract-form" 
                startIcon={<AddIcon />}
                variant="contained"
                sx={{ ml: 1 }}
              >
                New Contract
              </Button>
            </Box>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

export default NavBar; 