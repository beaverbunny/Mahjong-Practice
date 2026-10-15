import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Always open on the header and table, even after a reload while scrolled down to the footer
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

createRoot(document.getElementById('root')!).render(<App />);
