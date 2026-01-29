# Installation Guide 💻

Complete installation instructions for the Morning Briefing System.

## 📋 System Requirements

### Operating System
- **Linux**: Ubuntu 18.04+, CentOS 7+, or other modern distributions
- **macOS**: macOS 10.14 (Mojave) or later
- **Windows**: Windows 10 or Windows Server 2019+

### Python Version
- **Python 3.8+** (recommended: Python 3.9 or 3.10)
- **pip** package manager
- **virtualenv** or **conda** (recommended)

### Hardware Requirements
- **RAM**: Minimum 2GB, recommended 4GB+
- **Storage**: 500MB free space
- **Network**: Stable internet connection for API calls

---

## 🚀 Quick Installation

### Option 1: Using pip (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-username/morning-briefing-system.git
cd morning-briefing-system

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy configuration template
cp config_template.yaml config.yaml
```

### Option 2: Using conda

```bash
# Clone the repository
git clone https://github.com/your-username/morning-briefing-system.git
cd morning-briefing-system

# Create conda environment
conda create -n morning-briefing python=3.9
conda activate morning-briefing

# Install dependencies
pip install -r requirements.txt

# Copy configuration template
cp config_template.yaml config.yaml
```

---

## 📦 Dependencies

### Core Requirements

Create `requirements.txt`:
```txt
# Google APIs
google-auth==2.25.2
google-auth-oauthlib==1.1.0
google-auth-httplib2==0.1.1
google-api-python-client==2.110.0

# HTTP Requests
requests==2.31.0
urllib3==2.1.0

# Data Processing
pyyaml==6.0.1
python-dateutil==2.8.2
pytz==2023.3

# File Handling
pathlib2==2.3.7

# Optional: AI Integration
openai==1.6.1
anthropic==0.8.1

# Optional: Enhanced Features
beautifulsoup4==4.12.2
lxml==4.9.3
Pillow==10.1.0

# Optional: Notifications
plyer==2.1.0

# Optional: Email Notifications
smtplib3==0.1.1

# Development and Testing (optional)
pytest==7.4.3
black==23.11.0
flake8==6.1.0
```

### Development Dependencies (Optional)

Create `requirements-dev.txt`:
```txt
# Testing
pytest==7.4.3
pytest-cov==4.1.0
pytest-mock==3.12.0

# Code Formatting
black==23.11.0
isort==5.12.0
flake8==6.1.0

# Type Checking
mypy==1.7.1
types-requests==2.31.0.10

# Documentation
sphinx==7.2.6
sphinx-rtd-theme==1.3.0

# Security
bandit==1.7.5
safety==2.3.5
```

---

## 🔧 Platform-Specific Installation

### Ubuntu/Debian Linux

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python and pip
sudo apt install python3 python3-pip python3-venv -y

# Install system dependencies
sudo apt install build-essential libssl-dev libffi-dev python3-dev -y

# Clone and setup
git clone https://github.com/your-username/morning-briefing-system.git
cd morning-briefing-system
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### CentOS/RHEL/Fedora

```bash
# Install Python and development tools
sudo dnf install python3 python3-pip python3-devel gcc openssl-devel -y
# or for older versions: sudo yum install python3 python3-pip python3-devel gcc openssl-devel -y

# Clone and setup
git clone https://github.com/your-username/morning-briefing-system.git
cd morning-briefing-system
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### macOS

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python
brew install python@3.9

# Clone and setup
git clone https://github.com/your-username/morning-briefing-system.git
cd morning-briefing-system
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### Windows

```powershell
# Install Python from python.org or Microsoft Store
# Ensure Python and pip are in PATH

# Clone repository (using Git for Windows or download ZIP)
git clone https://github.com/your-username/morning-briefing-system.git
cd morning-briefing-system

# Create virtual environment
python -m venv venv
venv\Scripts\activate

# Install dependencies
python -m pip install --upgrade pip
pip install -r requirements.txt
```

---

## 📁 Directory Structure Setup

After installation, create the required directory structure:

```bash
# Create directories
mkdir -p credentials tokens cache briefings backups logs

# Set appropriate permissions (Linux/macOS)
chmod 700 credentials tokens
chmod 755 cache briefings backups logs

# Create initial files
touch logs/morning_briefing.log
echo "# Morning Briefing Logs" > logs/README.md
```

Expected structure:
```
morning-briefing-system/
├── credentials/           # API credential files (keep secure)
├── tokens/               # OAuth tokens (auto-generated)
├── cache/                # Temporary cache files
├── briefings/            # Generated briefing documents
├── backups/              # Backup files
├── logs/                 # Log files
├── src/                  # Source code
├── docs/                 # Documentation
├── config.yaml           # Your configuration file
└── requirements.txt      # Python dependencies
```

---

## 🔑 Environment Variables Setup

### Linux/macOS - Using ~/.bashrc or ~/.zshrc

```bash
# Add to your shell profile
echo 'export GOOGLE_CALENDAR_CREDENTIALS_FILE="/path/to/credentials/calendar_credentials.json"' >> ~/.bashrc
echo 'export GOOGLE_GMAIL_CREDENTIALS_FILE="/path/to/credentials/gmail_credentials.json"' >> ~/.bashrc
echo 'export OPENWEATHER_API_KEY="your-api-key"' >> ~/.bashrc
echo 'export OPENAI_API_KEY="your-api-key"' >> ~/.bashrc

# Reload profile
source ~/.bashrc
```

### Linux/macOS - Using .env file

```bash
# Create .env file
cat > .env << EOF
GOOGLE_CALENDAR_CREDENTIALS_FILE="./credentials/calendar_credentials.json"
GOOGLE_GMAIL_CREDENTIALS_FILE="./credentials/gmail_credentials.json"
OPENWEATHER_API_KEY="your-openweather-api-key"
OPENAI_API_KEY="your-openai-api-key"
EOF

# Set secure permissions
chmod 600 .env
```

### Windows - Using Environment Variables

```powershell
# Set user environment variables
[Environment]::SetEnvironmentVariable("GOOGLE_CALENDAR_CREDENTIALS_FILE", "C:\path\to\credentials\calendar_credentials.json", "User")
[Environment]::SetEnvironmentVariable("GOOGLE_GMAIL_CREDENTIALS_FILE", "C:\path\to\credentials\gmail_credentials.json", "User")
[Environment]::SetEnvironmentVariable("OPENWEATHER_API_KEY", "your-api-key", "User")
[Environment]::SetEnvironmentVariable("OPENAI_API_KEY", "your-api-key", "User")
```

### Windows - Using .env file

```powershell
# Create .env file
@"
GOOGLE_CALENDAR_CREDENTIALS_FILE=".\credentials\calendar_credentials.json"
GOOGLE_GMAIL_CREDENTIALS_FILE=".\credentials\gmail_credentials.json"
OPENWEATHER_API_KEY="your-openweather-api-key"
OPENAI_API_KEY="your-openai-api-key"
"@ | Out-File -FilePath .env -Encoding UTF8
```

---

## ⚙️ Configuration

### 1. Copy Configuration Template
```bash
cp config_template.yaml config.yaml
```

### 2. Edit Configuration
Edit `config.yaml` with your preferred settings. Key sections:
- **General**: User name, timezone, output preferences
- **Calendar**: Google Calendar settings
- **Email**: Gmail integration settings
- **Weather**: Location and weather preferences
- **AI**: OpenAI/Anthropic API settings

### 3. Validate Configuration
```bash
python -c "
import yaml
with open('config.yaml') as f:
    config = yaml.safe_load(f)
print('Configuration loaded successfully!')
print(f'User: {config[\"general\"][\"user_name\"]}')
"
```

---

## ✅ Installation Verification

### Basic System Check
```bash
# Verify Python version
python --version

# Verify pip
pip --version

# Check virtual environment
which python  # Should point to venv/bin/python

# Test imports
python -c "import google.auth; print('Google Auth: OK')"
python -c "import requests; print('Requests: OK')"
python -c "import yaml; print('YAML: OK')"
```

### API Connectivity Test
```bash
# Test basic functionality
python -c "
from src.weather_checker import WeatherChecker
weather = WeatherChecker()
print('Weather API: OK' if weather else 'Weather API: FAILED')
"
```

### Full System Test
```bash
# Run minimal test
python main.py --test
```

---

## 🐳 Docker Installation (Alternative)

### Option 1: Using Docker Compose
```yaml
# docker-compose.yml
version: '3.8'
services:
  morning-briefing:
    build: .
    volumes:
      - ./credentials:/app/credentials:ro
      - ./config.yaml:/app/config.yaml:ro
      - ./briefings:/app/briefings
    environment:
      - OPENWEATHER_API_KEY=${OPENWEATHER_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    command: python main.py
```

### Option 2: Docker Run
```bash
# Build image
docker build -t morning-briefing .

# Run container
docker run -d \
  -v $(pwd)/credentials:/app/credentials:ro \
  -v $(pwd)/config.yaml:/app/config.yaml:ro \
  -v $(pwd)/briefings:/app/briefings \
  -e OPENWEATHER_API_KEY="your-key" \
  morning-briefing
```

---

## 🔧 Troubleshooting Installation

### Common Issues

**1. Python Version Issues**
```bash
# Check Python version
python --version
python3 --version

# Use specific Python version
python3.9 -m venv venv
```

**2. Permission Issues (Linux/macOS)**
```bash
# Fix permissions
sudo chown -R $USER:$USER ./morning-briefing-system
chmod -R 755 ./morning-briefing-system
chmod 700 credentials tokens
```

**3. SSL Certificate Issues**
```bash
# Update certificates
pip install --upgrade certifi
```

**4. Network/Proxy Issues**
```bash
# Configure pip for proxy
pip install --proxy http://proxy.company.com:8080 -r requirements.txt
```

**5. Windows Path Issues**
```powershell
# Use forward slashes or double backslashes in paths
$env:GOOGLE_CALENDAR_CREDENTIALS_FILE = "C:/path/to/credentials.json"
```

---

## 🚀 Next Steps

After successful installation:
1. ✅ Follow the [API Setup Guide](API_SETUP.md)
2. ✅ Configure your settings in `config.yaml`
3. ✅ Review [Usage Examples](USAGE_EXAMPLES.md)
4. ✅ Run your first morning briefing!

---

## 📞 Support

If you encounter installation issues:
1. Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Verify system requirements
3. Check Python and pip versions
4. Ensure all dependencies are installed
5. Open an issue with installation logs