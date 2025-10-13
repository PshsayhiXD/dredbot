import express from 'express';
import paths from '../../utils/path.js';
export default ({}) => {
  const Router = express.Router();
  Router.get('/terms', (req, res) => {
    res.sendFile(paths.public.terms);
  });
  return Router;
};