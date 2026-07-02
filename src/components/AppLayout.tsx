import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { NavLink, Outlet } from 'react-router-dom'
import { AppLogoIcon } from '../assets/icons/AppLogoIcon'

const navLinkSx = {
  textTransform: 'none' as const,
  fontWeight: 500,
  borderRadius: '999px',
  px: 2,
  py: 0.75,
  color: 'text.secondary',
  '&:hover': {
    bgcolor: 'action.hover',
    color: 'text.primary',
  },
  '&.active': {
    color: 'primary.main',
    bgcolor: 'action.selected',
  },
}

export function AppLayout() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: 64, gap: { xs: 1.5, sm: 4 }, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'center' }, py: { xs: 1.5, sm: 0 } }}>
            <Box
              component={NavLink}
              to="/"
              end
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 1,
                color: 'text.primary',
                textDecoration: 'none',
                fontWeight: 700,
                flexShrink: 0,
                '&:hover': { color: 'primary.main' },
              }}
            >
              <AppLogoIcon size={28} strokeWidth={2} style={{ color: 'inherit' }} />
              <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700 }}>
                Outcome Analytic
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.5} aria-label="Основная навигация" sx={{ overflowX: 'auto' }}>
              <Button component={NavLink} to="/" end sx={navLinkSx}>
                Главная
              </Button>
              <Button component={NavLink} to="/categories" sx={navLinkSx}>
                По категориям
              </Button>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>

      <Container maxWidth="lg" sx={{ flex: 1, py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  )
}
