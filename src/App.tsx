import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { HomePage } from './routes/HomePage';
import { GamePage } from './routes/GamePage';
import { LevelSelectPage } from './routes/LevelSelectPage';
import { SettingsPage } from './routes/SettingsPage';

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/levels" element={<LevelSelectPage />} />
          <Route path="/game/:levelId" element={<GamePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
