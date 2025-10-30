# EcoTwinAI - Urban Building Energy Visualization

A secure full-stack web application for urban building energy analysis with 3D visualization and Mapbox integration.

## 🏗️ Project Structure

```
ecotwinai_new/
├── backend/                    # Backend API Server
│   ├── server.js              # Express server
│   ├── package.json           # Backend dependencies
│   ├── .env                   # Environment variables
│   ├── env.example            # Environment template
│   ├── Dockerfile             # Docker configuration
│   ├── docker-compose.yml     # Docker Compose setup
│   └── node_modules/          # Backend dependencies
├── frontend/                   # Frontend Application
│   ├── index.html             # Main HTML file
│   ├── script.js              # Frontend JavaScript
│   └── style.css              # Frontend styling
├── data/                       # Sample Data
│   ├── EcoTwinUse_clean.geojson
│   └── sample.geojson
├── docs/                       # Documentation
│   ├── PROJECT_DOCUMENTATION.md
│   ├── DEPLOYMENT.md
│   └── QUICK_START.md
├── package.json               # Root package.json
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

## ✨ Features

- 🏢 **3D Building Visualization** - Interactive 3D building models with energy-based color coding
- 🌳 **Tree Simulation** - Add virtual trees for environmental analysis
- ☀️ **Sun Simulation** - Real-time sun position and lighting effects
- 🔒 **Secure Architecture** - Backend API with protected Mapbox access token
- 📊 **Energy Analytics** - Visualize building energy consumption patterns
- 🐳 **Docker Support** - Easy deployment with Docker and Docker Compose

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Mapbox account and access token

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ecotwinai_new
   ```

2. **Install backend dependencies**
   ```bash
   npm run install-backend
   ```

3. **Configure environment**
   ```bash
   cd backend
   cp env.example .env
   ```
   
   Edit `backend/.env` file and add your Mapbox access token:
   ```
   MAPBOX_ACCESS_TOKEN=your_mapbox_access_token_here
   PORT=3000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000`

## 🛠️ Development

### Running in Development Mode

```bash
# Start backend with auto-reload
npm run dev

# Or run backend directly
cd backend && npm run dev
```

### Available Scripts

- `npm start` - Start the backend server
- `npm run dev` - Start backend in development mode
- `npm run install-backend` - Install backend dependencies
- `npm run docker` - Start with Docker Compose
- `npm run docker-build` - Build Docker image
- `npm run docker-down` - Stop Docker containers

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Set environment variable
export MAPBOX_ACCESS_TOKEN=your_token_here

# Start with Docker Compose
npm run docker

# Or directly
cd backend && docker-compose up -d
```

### Using Docker directly

```bash
cd backend
docker build -t ecotwinai .
docker run -d -p 3000:3000 -e MAPBOX_ACCESS_TOKEN=your_token_here ecotwinai
```

## 🔐 Security Features

- ✅ **Protected Mapbox Token** - Access token stored securely on backend
- ✅ **Environment Variables** - Sensitive data in .env file
- ✅ **CORS Configuration** - Controlled cross-origin requests
- ✅ **Error Handling** - Graceful error management
- ✅ **Separated Architecture** - Clean separation of frontend and backend

## 📡 API Endpoints

- `GET /api/mapbox-config` - Get Mapbox configuration (token, style, etc.)
- `GET /api/health` - Health check endpoint
- `GET /` - Serve the main application

## 📚 Documentation

- [**Quick Start Guide**](docs/QUICK_START.md) - Get started in 5 minutes
- [**Project Documentation**](docs/PROJECT_DOCUMENTATION.md) - Detailed technical documentation
- [**Deployment Guide**](docs/DEPLOYMENT.md) - Production deployment instructions

## 🌐 Deployment

### Environment Variables for Production

```bash
MAPBOX_ACCESS_TOKEN=your_production_token
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
```

### Supported Platforms

- **Heroku** - Easy deployment with Git
- **Docker** - Containerized deployment
- **AWS** - Elastic Beanstalk, ECS, or EC2
- **Google Cloud** - Cloud Run or Compute Engine
- **DigitalOcean** - App Platform or Droplets
- **Vercel** - Serverless deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 Check the [documentation](docs/)
- 🐛 Report bugs by creating an [issue](../../issues)
- 💬 Ask questions in [discussions](../../discussions)
- 📧 Contact: [Your Email]

## 🙏 Acknowledgments

- [Mapbox](https://www.mapbox.com/) for mapping services
- [Turf.js](https://turfjs.org/) for geospatial calculations
- [SunCalc](https://github.com/mourner/suncalc) for sun position calculations