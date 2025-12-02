Backend Code Refactoring Plan
Overview
The current backend has all modules in a flat 
app/
 directory structure. This refactoring will reorganize the code into a cleaner, more maintainable architecture with better separation of concerns, improved documentation, and higher code quality.

Current Structure Analysis
Current Issues
Flat directory structure - All 12 Python files in one directory makes navigation difficult
Mixed concerns - GeNN-specific, API, input handling, and utilities all mixed together
Inconsistent documentation - Some files well-documented, others minimal
Code duplication - Similar patterns repeated across files
Missing type hints - Not all functions have proper type annotations
Large files - Some files (e.g., 
runner_generator.py
 at 464 lines, 
genn_builder.py
 at 525 lines) could be split
Configuration scattered - Constants and config values spread throughout code
Proposed New Structure
back/
├── app/
│   ├── __init__.py
│   ├── __main__.py              # Entry point (minimal changes)
│   ├── main.py                  # Main FastAPI app (renamed from main_genn.py)
│   │
│   ├── api/                     # API layer
│   │   ├── __init__.py
│   │   ├── routes.py            # All API route handlers
│   │   ├── schemas.py           # Pydantic models (expanded)
│   │   └── dependencies.py      # FastAPI dependencies
│   │
│   ├── core/                    # Core business logic
│   │   ├── __init__.py
│   │   ├── config.py            # Configuration and constants
│   │   └── exceptions.py        # Custom exceptions
│   │
│   ├── genn/                    # GeNN-specific modules
│   │   ├── __init__.py
│   │   ├── builder.py           # Network builder (from genn_builder.py)
│   │   ├── simulator.py         # Simulation engine (from genn_simulator.py)
│   │   ├── runner_generator.py  # C++ runner code generation
│   │   └── cpp_manager.py       # C++ runner subprocess management
│   │
│   ├── input/                   # Input handling
│   │   ├── __init__.py
│   │   ├── provider.py          # Base input provider
│   │   ├── python_generator.py  # Python-based input
│   │   └── sandbox.py           # Safe Python execution
│   │
│   ├── process/                 # Process management
│   │   ├── __init__.py
│   │   └── manager.py           # Process lifecycle management
│   │
│   └── utils/                   # Utilities and helpers
│       ├── __init__.py
│       ├── validation.py        # Input validation helpers
│       └── logging.py           # Logging configuration
│
├── cpp_runner/                  # C++ runner code (no changes)
├── tests/                       # Tests
├── requirements.txt
└── README.md
Detailed Changes
1. API Layer (app/api/)
[NEW] 
routes.py
Extract all route handlers from 
main_genn.py
Organize into logical groups: network, simulation, input
Add comprehensive docstrings
Improve error handling
[MODIFY] 
schemas.py
 → 
api/schemas.py
Move and expand current schemas
Add validation rules
Add response models
Add comprehensive docstrings
[NEW] 
dependencies.py
FastAPI dependency injection functions
Request validation
State management
2. Core Layer (app/core/)
[NEW] 
config.py
Centralize all configuration
Define constants (ports, timeouts, paths)
Environment-based settings
Backend selection logic
[NEW] 
exceptions.py
Custom exception classes
Error codes and messages
Exception handlers for FastAPI
3. GeNN Layer (app/genn/)
[MODIFY] 
genn_builder.py
 → 
genn/builder.py
Move to new location
Extract neuron model creation into separate methods
Extract synapse creation logic
Add more comprehensive type hints
Improve error messages
[MODIFY] 
genn_simulator.py
 → 
genn/simulator.py
Move to new location
Simplify state extraction logic
Better separation of concerns
Add type hints
[MODIFY] 
runner_generator.py
 → 
genn/runner_generator.py
Move to new location
Extract template strings to separate file or constants
Add more helper methods for code generation
Improve documentation
[MODIFY] 
genn_cpp_manager.py
 → 
genn/cpp_manager.py
Move to new location
Improve process lifecycle management
Better error handling
Add type hints
4. Input Layer (app/input/)
[MODIFY] 
input_provider.py
 → 
input/provider.py
Move to new location
Improve connection handling
Add reconnection logic
Better error messages
[MODIFY] 
python_input_generator.py
 → 
input/python_generator.py
Move to new location
Improve result processing
Add validation
Better error handling
[MODIFY] 
sandbox.py
 → 
input/sandbox.py
Move to new location
Expand allowed modules configuration
Improve timeout handling
Add more comprehensive validation
5. Process Layer (app/process/)
[MODIFY] 
process_manager.py
 → 
process/manager.py
Move to new location
Improve process monitoring
Add health checks
Better cleanup logic
6. Main Application
[MODIFY] 
main_genn.py
 → 
main.py
Rename for clarity
Simplify to just app setup and middleware
Import routes from api/routes.py
Add startup/shutdown events
Improve CORS configuration
[MODIFY] 
main.py
Update import to use new main.py
Add better startup logging
Add configuration display
7. Code Quality Improvements
Type Hints
Add comprehensive type hints to all functions
Use typing module properly (Optional, Dict, List, Any, etc.)
Add return type annotations
Documentation
Add module-level docstrings to all files
Improve function/method docstrings with Args, Returns, Raises sections
Add inline comments for complex logic
Create README.md for backend with architecture overview
Constants & Configuration
Extract magic numbers to named constants
Centralize configuration in core/config.py
Use environment variables where appropriate
Error Handling
Use custom exceptions from core/exceptions.py
Add proper error messages
Improve logging throughout
Code Simplification
Break down large functions into smaller helpers
Remove code duplication
Use consistent naming conventions
Follow PEP 8 style guide
Verification Plan
Import Verification
Verify all imports resolve correctly
Check for circular dependencies
Ensure backward compatibility where needed
Functional Testing
Start the server and verify it runs
Test network loading endpoint
Test simulation start/stop
Test WebSocket connections
Verify C++ runner compilation and execution
Manual Verification
Review code structure for clarity
Check documentation completeness
Verify type hints are correct
Ensure consistent style throughout
Migration Strategy
Create new directory structure - Create all new directories
Move files incrementally - Move and refactor one module at a time
Update imports - Fix all import statements as we go
Test after each module - Ensure nothing breaks
Final cleanup - Remove old files, update documentation
Benefits
Better Organization - Clear separation of concerns makes code easier to navigate
Improved Maintainability - Smaller, focused modules are easier to maintain
Enhanced Readability - Better documentation and structure
Easier Testing - Modular structure makes unit testing easier
Scalability - Clear architecture makes it easier to add features
Professional Quality - Industry-standard structure and practices