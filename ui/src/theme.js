import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3d5afe', // Modern blue
      light: '#8187ff',
      dark: '#0031ca',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#00b0ff', // Light blue
      light: '#69e2ff',
      dark: '#0081cb',
      contrastText: '#ffffff',
    },
    background: {
      default: 'transparent',
      paper: 'rgba(29, 38, 48, 0.8)',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#ff9800',
    },
    info: {
      main: '#29b6f6',
    },
    success: {
      main: '#66bb6a',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 700,
    },
    h3: {
      fontWeight: 600,
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
    button: {
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backdropFilter: 'blur(8px)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          boxShadow: 'none',
          textTransform: 'none',
          '&:hover': {
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(45deg, #3d5afe 30%, #536dfe 90%)',
          '&:hover': {
            background: 'linear-gradient(45deg, #3d5afe 50%, #536dfe 100%)',
          },
        },
        containedSecondary: {
          background: 'linear-gradient(45deg, #00b0ff 30%, #40c4ff 90%)',
          '&:hover': {
            background: 'linear-gradient(45deg, #00b0ff 50%, #40c4ff 100%)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          backgroundColor: 'rgba(25, 32, 45, 0.8)',
          backdropFilter: 'blur(8px)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(255, 255, 255, 0.4)',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#3d5afe',
            },
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          borderRadius: 12,
        },
      },
    },
  },
});

export default theme; 