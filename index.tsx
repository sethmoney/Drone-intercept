import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = ReactDOM.createRoot(rootElement);
root.render(
  // StrictMode is nice, but for physics engines that use Singletons or global listeners
  // it can sometimes cause double-initialization bugs if not handled perfectly.
  // We have handled it in SimCanvas via mountRef checks, so we keep it.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
