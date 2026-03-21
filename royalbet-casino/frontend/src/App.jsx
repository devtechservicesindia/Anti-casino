import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Pages (scaffold – to be implemented)
// import Home from '@pages/Home';
// import Login from '@pages/Login';
// import Register from '@pages/Register';
// import Dashboard from '@pages/Dashboard';
// import Slots from '@pages/Slots';
// import Roulette from '@pages/Roulette';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* TODO: Add layout wrapper here */}
        <Routes>
          <Route path="/" element={<div>🎰 RoyalBet Casino – Coming Soon</div>} />
          {/* Add routes as pages are built */}
        </Routes>
        <Toaster position="top-center" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
