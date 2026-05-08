import React from 'react';
import { createRoot } from 'react-dom/client';
import { Box, Typography } from '@mui/material';

const container = document.getElementById('root');

if (container) {
    const root = createRoot(container);
    root.render(
        <React.StrictMode>
            <Box sx={{ p: 2, fontFamily: 'sans-serif' }}>
                <Typography variant="h6">EMS Admin Components</Typography>
                <Typography variant="body2">
                    Dieser Build dient nur als Entry fuer die Custom-Komponenten.
                </Typography>
            </Box>
        </React.StrictMode>,
    );
}