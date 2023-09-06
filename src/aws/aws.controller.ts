import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Res,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AwsService } from './aws.service';
// import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import { ProducerService } from 'src/kafka/producer/producer.service';
import * as fs from 'fs-extra';
import { multerOptions } from 'src/multer.config';


@Controller('aws')
export class AwsController {
  constructor(
    private readonly awsS3Service: AwsService,
    private readonly kafkaProducerService: ProducerService,
  ) {}

  // Upload Single from Presigned URL
  // @Post('presigned-url')
  // @UseInterceptors(FileInterceptor('file'))
  // async generatePresignedUrl(
  //   @UploadedFile() file: Express.Multer.File,
  // ): Promise<string> {
  //   const s3Path = `Arun/${file.originalname}`;

  //   try {
  //     const initialPresignedUrl = await this.awsS3Service.getuploadUrl(s3Path);
  //     console.log({initialPresignedUrl})

  //     const initialResponse = await fetch(initialPresignedUrl, {
  //       method: 'PUT',
  //       body: file.buffer,
  //     });

  //     if (initialResponse.ok) {
  //       console.log('File uploaded successfully');
  //     } else if (initialResponse.status === 403) {
  //       const newPresignedUrl = await this.awsS3Service.getuploadUrl(s3Path);

  //       const newResponse = await fetch(newPresignedUrl, {
  //         method: 'PUT',
  //         body: file.buffer,
  //       });

  //       if (newResponse.ok) {
  //         console.log('File uploaded successfully with renewed URL');
  //       } else {
  //         console.error('File upload failed with renewed URL');
  //       }
  //     } else {
  //       console.error('File upload failed');
  //     }
  //   } catch (error) {
  //     console.error('An error occurred:', error.message);
  //   }

  //   return 'uploaded successfully';
  // }
  @Post('presigned-url')
  @UseInterceptors(FileInterceptor('file'))
  async generatePresignedUrl(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<string> {
    const s3Path = `uploads/${file.originalname}`;

    try {
      const presignedUrl = await this.awsS3Service.getuploadUrl(s3Path);
      console.log({ presignedUrl });

      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file.buffer,
        headers: {
          'Content-Type': file.mimetype, // Set the correct Content-Type header
        },
      });

      if (response.ok) {
        console.log('File uploaded successfully');
        return 'uploaded successfully';
      } else {
        console.error('File upload failed');
        throw new Error('File upload failed');
      }
    } catch (error) {
      console.error('An error occurred:', error.message);
      throw error; // Re-throw the error to be caught by NestJS error handling
    }
  }


  // Upload Multiple Files
  @Post('upload-files')
  @UseInterceptors(FilesInterceptor('files', null, multerOptions))
  async uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[]) {
    console.log({ files });

    if (!Array.isArray(files)) {
      files = [files]; // Wrap the single file in an array
    }

    const uploadedFileUrls = await Promise.all(
      files.map(async (file) => {
        console.log({file: file.originalname})
        const fileKey = `Arun/mutiple-uploads/kafka/${file.originalname}`;
        const filePath = `/home/syncoffice/projects/testing-project-aws-kafka/uploads/${file.originalname}`
        await this.kafkaProducerService.produce({
          topic: 'upload-file-topic',
          messages: [{ value: filePath, key: fileKey }],
        });
        // return this.awsS3Service.uploadFile(bucketName, fileKey, file.buffer);
        return 'check console';
      }),
    );

    return { uploadedFileUrls };
    // return 'hi'
  }

  // Upload Large File
  @Post('cli')
  @UseInterceptors(FileInterceptor('file', multerOptions))
  async uploadFileWithCLI(@UploadedFile() file: Express.Multer.File) {
    console.log('Received file:', file);

    console.log('this is controller');
    if (!file) throw new NotFoundException({ message: 'send valid file' });
    const fileKey = `Arun/largeUploads/kafka/${file.originalname}`;

    //File saving into localpath
    // const filePath = await this.saveFileIntoLocal(file);
    const filePath = `/home/syncoffice/projects/testing-project-aws-kafka/uploads/${file.originalname}`
    console.log({ filePath });

    const result = await this.kafkaProducerService.produceLargeFile({
      topic: 'upload-large-file-topic',
      messages: [{ value: filePath as string, key: fileKey }],
    });

    console.log({result})
    // const result = await this.awsS3Service.uploadFileWithCLI(fileKey, filePath);

    // fs.unlinkSync(filePath);
    // return result;
    return 'Check Console';
  }

  // Save the file temporarily
  // async saveFileINtoLocal(file: Express.Multer.File) {
  //   const tempFolderPath = 'tempUploads'; // Define your temporary folder path
  //   console.log({ fileName: file.originalname, tempFolderPath });
  //   const tempFilePath = path.join(tempFolderPath, file.originalname);
  //   console.log({ tempFilePath });

  //   // Ensure the temporary folder exists
  //   if (!fs.existsSync(tempFolderPath)) {
  //     fs.mkdirSync(tempFolderPath, { recursive: true });
  //   }

  //   console.log('now saving into tempUploads')

  //   // Save the file
  //    fs.writeFileSync(tempFilePath, file.buffer);
  //   console.log('returning path')

  //   return tempFilePath;
  // }


 

  async saveFileIntoLocal(file: Express.Multer.File): Promise<string> {
    const tempFolderPath = 'tempUploads'; // Define your temporary folder path
    const tempFilePath = path.join(tempFolderPath, file.originalname);
  
    // Ensure the temporary folder exists
    await fs.ensureDir(tempFolderPath);
  
    console.log('Now saving into tempUploads');
  
    // Check for null bytes in the file buffer
    if (file.buffer.includes(0x00)) {
      throw new Error('File contains null bytes and is not allowed.');
    }
  
    const writeStream = fs.createWriteStream(tempFilePath);
  
    return new Promise<string>((resolve, reject) => {
      const readStream = fs.createReadStream(file.buffer);
  
      readStream
        .pipe(writeStream)
        .on('error', (error) => {
          console.error('Error saving the file:', error);
          reject(error);
        })
        .on('finish', () => {
          console.log('File saved successfully');
          resolve(tempFilePath);
        });
    });
  }

  // Upload Folder
  @Post('upload-folder')
  async uploadFolder(@Body() body) {
    const { folderpath } = body;
    const folderPath = '/home/syncoffice/Downloads/10,000 files'; // Update with your folder path
    await this.awsS3Service.uploadFolder(folderPath);
    return { message: 'Folder uploaded successfully' };
  }

  // Download Multiple Files
  @Get('download-from-presigned-urls')
  async downloadFromPresignedUrls(@Body() body, @Res() response: Response) {
    const { s3Keys } = body;

    try {
      // Set common headers for the response
      response.setHeader('Content-Type', 'application/octet-stream');
      console.log('Arunnnnnnnnnnnnnnnnnnnnnnnn');
      console.log({ s3Keys });

      for (const s3Key of s3Keys) {
        const fileStream =
          await this.awsS3Service.getFileStreamFromPresignedUrl(s3Key);

        // Determine the Content-Type based on the file extension or type
        let contentType = 'application/octet-stream'; // Default to binary
        if (s3Key.endsWith('.txt')) {
          contentType = 'text/plain';
        } else if (s3Key.endsWith('.pdf')) {
          contentType = 'application/pdf';
        } // Add more conditions for other file types

        // Set appropriate headers for each file
        response.setHeader(
          'Content-Disposition',
          `attachment; filename=${s3Key}`,
        );
        response.setHeader('Content-Type', contentType);

        // Pipe the file stream to the response stream
        await new Promise((resolve, reject) => {
          fileStream.on('error', reject);
          fileStream.pipe(response).on('finish', resolve); // Ensure finish event
        });
      }
    } catch (error) {
      console.error('Error:', error);
      response
        .status(500)
        .send({ error: 'Failed to download files from presigned URLs' });
    }
  }

  // Download Single File
  @Get('download-from-presigned-url')
  async downloadFromPresignedUrl(@Body() body, @Res() response: Response) {
    const { s3Key } = body;
    try {
      const fileStream = await this.awsS3Service.getFileStreamFromPresignedUrl(
        s3Key,
      );

      // Determine the Content-Type based on the file extension or type
      let contentType = 'application/octet-stream'; // Default to binary
      if (s3Key.endsWith('.txt')) {
        contentType = 'text/plain';
      } else if (s3Key.endsWith('.pdf')) {
        contentType = 'application/pdf';
      } // Add more conditions for other file types

      // Set appropriate headers for the response
      response.setHeader(
        'Content-Disposition',
        `attachment; filename=${s3Key}`,
      );
      // 'attachment; filename="downloaded-file.txt"',
      response.setHeader('Content-Type', contentType);

      // Pipe the file stream to the response stream
      fileStream.pipe(response);
    } catch (error) {
      response
        .status(500)
        .send({ error: 'Failed to download file from presigned URL' });
    }
  }

  // Sending Zipfile in email
  // @Get('download/folder')
  // async downloadFolder(
  //   // @Param('folderName') folderName: string,
  //   @Body() body,
  //   @Res() res: Response,
  // ) {
  //   const { folderName } = body;
  //   try {
  //     const zipFileBuffer = await this.awsS3Service.downloadFolderAsZip(
  //       folderName,
  //       res,
  //     );
  //     console.log('zip file complted');
  //     // Now send the email using the SendinblueService
  //     // await this.sendinblueService.sendEmailWithAttachment(
  //     //   'arunkumar800a@gmail.com',
  //     //   'Download Link',
  //     //   'Please find the attached zip file.',
  //     //   folderName,
  //     //   zipFileBuffer,
  //     // );
  //     console.log('sending complted');
  //     return 'Check your Email';
  //   } catch (error) {
  //     // Handle errors
  //     console.error('Error downloading and sending folder:', error);
  //     return res.status(500).send('Internal Server Error');
  //   }
  // }

  @Get('download/folder')
  async downloadFolder(
    // @Param('folderName') folderName: string,
    @Body() body,
    @Res() res: Response,
  ) {
    const { folderName } = body;
    try {
      const zipFileBuffer = await this.awsS3Service.downloadFolderAsZip(
        folderName,
        res,
      );

      // Set response headers for download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${folderName}.zip`,
      );

      // Send the zip file buffer as the response
      res.send(zipFileBuffer);

      console.log('Download completed');
    } catch (error) {
      // Handle errors
      console.error('Error downloading folder:', error);
      return res.status(500).send('Internal Server Error');
    }
  }
}
