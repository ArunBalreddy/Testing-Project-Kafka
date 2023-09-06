import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as AWS from 'aws-sdk'; // Import AWS SDK
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import  axios from 'axios'; // Import axios
import * as os from 'os'; // Import os module
import { Readable} from 'stream';
import * as archiver from 'archiver';
import { Response } from 'express';
import { S3 } from 'aws-sdk';
import * as util from 'util';



@Injectable()
export class AwsService {
  private readonly s3Client = new S3Client({
    region: this.configService.get<string>('AWS_S3_REGION'),
  });

  private readonly s3: AWS.S3;
  uploadedFiles = 0; // Initialize the uploadedFiles property
  
  constructor(
    private readonly configService: ConfigService,
  ) // private readonly logger = new Logger('S3UploadService')

  {
    this.s3 = new S3({
      region: this.configService.get<string>('AWS_S3_REGION'),
      accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
      secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
    });
  }


  // Ger Presigned Url
  async getuploadUrl(s3Path: string): Promise<string> {
    const bucketName = 'new-syncoffice-test';
    const expirationDurationInSeconds = 3600; // 1 hour
  
    const params: S3.Types.PutObjectRequest = {
      Bucket: bucketName,
      Key: s3Path,
      Expires: expirationDurationInSeconds as any // URL expires in 1 hour
    };
  
    const presignedUrl = await this.s3.getSignedUrlPromise('putObject', params);
    return presignedUrl;
  }

  // Upload file Service
  async uploadFile(
    filePath: string,
    fileKey: string,
  
  ): Promise<string> {
    const readFile = util.promisify(fs.readFile);
    const fileBuffer = await readFile(filePath);
    const params = {
      Bucket: 'new-syncoffice-test',
      Key: fileKey,
      Body: fileBuffer,
    };

    try {
      await this.s3.upload(params).promise();
      return `Uploaded Successfully ${fileKey}`;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error('File upload failed');
    }
  }

  // Upoload Large file service
  async uploadFileWithCLI( fileKey: string, filePath: string) {
    const bucketName = 'new-syncoffice-test';
    const command = `aws s3 cp ${filePath} s3://${bucketName}/${fileKey}`;

    const maxBuffer = 1024 * 1024 * 1024; // Set maxBuffer to 1GB

    return new Promise((resolve, reject) => {
      const childProcess = exec(command, { maxBuffer }, (error, stdout, stderr) => {
        if (error) {
          reject(`Error uploading file: ${error.message}`);
        } else {
          resolve(`File uploaded successfully`);
        }
      });

      childProcess.stdout.on('data', (data: string) => {
        console.log('Received data:', data); // Log the received data
      
        // Parse the data to get progress information
        const progressInfo = parseProgressData(data);
        // console.log({progressInfo})
        if (progressInfo) {
          const { percentage, remaining , remainingTime} = progressInfo;
          console.log(`Upload in progress: ${percentage}% completed`);
          console.log(`Remaining: ${remaining} bytes`);
          console.log(`Remaining Time: ${remainingTime} remainingTimeInSeconds`)
        }
      });
      
      childProcess.on('exit', (code) => {
        if (code === 0) {
          resolve(`File uploaded successfully`);
        } else {
          reject(`Error uploading file`);
        }
      });
    });
  }

  // Upload file service for uploading folder
  async uploadFileFolder(filename: string, file: Buffer) {
    const uploadPromise = this.s3Client.send(
      new PutObjectCommand({
        Bucket: 'new-syncoffice-test',
        Key: `Arun/another 10,000 files/${filename}`,
        Body: file,
      })
    );
    
    await uploadPromise;
    this.uploadedFiles += 1;
    console.log(`Total files uploaded: ${this.uploadedFiles}`);
  }

  // Upload Folder Service
  async uploadFolder(folderPath: string): Promise<void> {
    const files = this.readFilesRecursively(folderPath);

    for (const { filePath, relativePath } of files) {
      const fileContent = fs.readFileSync(filePath);
      await this.uploadFileFolder(relativePath, fileContent);
    }
  }

  private readFilesRecursively(
    basePath: string,
    currentPath = '',
  ): { filePath: string; relativePath: string }[] {
    const files = [];

    const entries = fs.readdirSync(path.join(basePath, currentPath), {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        const subFiles = this.readFilesRecursively(basePath, entryPath);
        files.push(...subFiles);
      } else {
        files.push({
          filePath: path.join(basePath, entryPath),
          relativePath: entryPath,
        });
      }
    }

    return files;
  }

  // Download File Service
  async getFileStreamFromPresignedUrl(s3Key: string): Promise<Readable> {
    console.log('Generating presigned URL...');
    const url = await this.generatePresignedUrl(s3Key);
    console.log('Generated URL:', url);

    try {
      console.log('Making Axios request...');
      const response = await axios.get(url, { responseType: 'stream' });
      // const response  = await this.fetchStreamFromUrl(url)
      console.log('Axios response:', response);
  
      const localPath = path.join(os.homedir(), 'Downloads/Arun', s3Key);
      const fileWriteStream = fs.createWriteStream(localPath);
      response.data.pipe(fileWriteStream);
  
      // Create a promise that resolves when the response stream ends
      const responseStreamEndPromise = new Promise<void>((resolve) => {
        response.data.on('end', resolve);
      });
  
      // Wait for the response stream to end before proceeding
      await responseStreamEndPromise;
  
      // Delay the deletion of the file after the response has been fully streamed
      setTimeout(() => {
        fs.unlink(localPath, (err) => {
          if (err) {
            console.error(`Failed to delete file: ${err.message}`);
          } else {
            console.log(`File ${localPath} deleted successfully.`);
          }
        });
      }, 15 * 1000); // 15 seconds delay
  
      return response.data;
    } catch (error) {
      // console.log(error)
      throw new Error(
        `Failed to fetch file from presigned URL: ${error.message}`,
      );
    }
  }

  async generatePresignedUrl(s3Key: string): Promise<string> {
    const params = {
      Bucket: 'new-syncoffice-test',
      Key: s3Key,
      Expires: 300,
    };

    try {
      const signedUrl = this.s3.getSignedUrl('getObject', params);
      return signedUrl;
    } catch (error) {
      throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
  }

  //Download Folder as Zip Service
  async downloadFolderAsZip(folderName: string, res: Response): Promise<Buffer> {
    const bucketName = 'new-syncoffice-test'; // Replace with your S3 bucket name
    const folderPrefix = `${folderName}`;
    console.log({folderPrefix})
  
    try {
      const listObjectsResponse = await this.s3
        .listObjectsV2({
          Bucket: bucketName,
          Prefix: folderPrefix,
        })
        .promise();
  
      const objects = listObjectsResponse.Contents;
      console.log({objects})
  
      if (!objects || objects.length === 0) {
        throw new Error('Folder not found');
      }
  
      const archive = archiver('zip', {
        zlib: { level: 9 },
      });
  
      const zipBuffers: Buffer[] = [];
  
      archive.on('data', (data) => {
        zipBuffers.push(data);
      });
  
      // Add files from S3 to the archive
      for (const object of objects) {
        console.log({object})
        const fileStream = this.s3
          .getObject({
            Bucket: bucketName,
            Key: object.Key,
          })
          .createReadStream();
  
        archive.append(fileStream, { name: object.Key });
      }
  
      return new Promise<Buffer>((resolve, reject) => {
        // Listen for 'end' event to resolve the promise with the zip buffer
        archive.on('end', () => {
          resolve(Buffer.concat(zipBuffers));
        });
  
        // Handle 'error' event to reject the promise in case of an error
        archive.on('error', (error) => {
          reject(error);
        });
  
        // Finalize the archive and send it
        archive.finalize();
      });
    } catch (error) {
      console.error('Error downloading folder:', error);
      throw new Error('Internal Server Error');
    }
  }
}





function parseProgressData(data: string) {
  const completedMatch = data.match(/Completed\s+([\d.]+)\s+(\w+)\s*\/\s*([\d.]+)\s+(\w+)\s+\(([\d.]+)\s+(\w+)\/s\)/);
  const remainingMatch = data.match(/with\s+(\d+)\s+file/);

  if (completedMatch && remainingMatch) {
    const completedAmount = parseFloat(completedMatch[1]);
    const completedUnit = completedMatch[2];
    const totalAmount = parseFloat(completedMatch[3]);
    const totalUnit = completedMatch[4];
    const speedAmount = parseFloat(completedMatch[5]);
    const speedUnit = completedMatch[6];
    const remainingFiles = parseInt(remainingMatch[1]);

    const completedBytes = convertToBytes(completedAmount, completedUnit);
    const totalBytes = convertToBytes(totalAmount, totalUnit);
    const remainingBytes = totalBytes - completedBytes;

    const percentage = (completedBytes / totalBytes) * 100;

    // Calculate remaining time (simple estimation based on constant upload speed)
    const remainingTimeInSeconds = remainingBytes / convertToBytes(speedAmount, speedUnit);
    const remainingMinutes = Math.floor(remainingTimeInSeconds / 60);

    return { percentage, remaining: remainingBytes, remainingTime: remainingMinutes };
  }

  return null; // Return null if parsing was unsuccessful
}


function convertToBytes(amount: number, unit: string): number {
  switch (unit) {
    case 'MiB':
      return amount * 1024 * 1024;
    case 'GiB':
      return amount * 1024 * 1024 * 1024;
    // Add more cases for other units if needed
    default:
      return amount;
  }
}