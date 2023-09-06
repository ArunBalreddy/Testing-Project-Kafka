// multer.config.ts

import { diskStorage } from 'multer';

export const multerOptions = {
  storage: diskStorage({
    destination: './uploads', // The directory where files will be stored
    filename: (req, file, callback) => {
      callback(null, `${file.originalname}`);
    },
  }),
};
