# UBC Course Insights
> A full-stack TypeScript application for analyzing course data across UBC Vancouver's campus, processing 64,000+ academic records through a RESTful API architecture.

## Core Features
- **High-Performance Data Processing**: Engineered scalable asynchronous pipelines handling 64K+ course sections with sub-second query responses
- **RESTful API Architecture**: Built robust REST endpoints with comprehensive error handling and request validation
- **Test-Driven Development**: Implemented 140+ unit/integration tests with 90%+ code coverage using Mocha/Chai
- **Type Safety**: Leveraged TypeScript's type system for robust data validation and error prevention

## Tech Stack
- **Backend**: TypeScript, Node.js, Express.js
- **Testing**: Mocha/Chai, Test-Driven Development
- **Architecture**: RESTful APIs, Facade Pattern, MVC Pattern
- **Developer Tools**: Git, ESLint, TypeScript Compiler

## Key Technical Implementations
- **Data Processing**
	- Designed efficient data structures for handling large datasets
	- Implemented async/await patterns for non-blocking operations
	- Built scalable query engine for dynamic dataset analysis

- **API Design**
	- Created RESTful endpoints for data retrieval and manipulation
	- Implemented comprehensive error handling and input validation
	- Built type-safe interfaces for API request/response cycles

- **Testing Strategy**
	- Developed extensive test suite with 140+ test cases
	- Maintained 90%+ code coverage across codebase
	- Used TDD methodology for robust feature development

## Development Tools & Practices
- **Version Control**: Git with feature branch workflow
- **Code Quality**: ESLint, Prettier
- **Documentation**: JSDoc, TypeScript interfaces
- **CI/CD**: Automated testing pipeline

## Getting Started
```bash
# Install dependencies
npm install

# Run tests
npm test

# Run with coverage
npm run cover

# Start server
npm start

# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start frontend
npm run dev
```

## A little tip
```
test
├── TestUtil.js
├── controller/
├── rest/
└── resources/
    ├── queries/
    └── archives/
    	└── find datasets to play with here ;)
```

## Contributing
Feel free to submit issues or pull requests to improve this project (e.g. query ideas). Contributions are always welcome!
