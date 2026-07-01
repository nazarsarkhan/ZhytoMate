"""
Purpose:   Package marker for components/* (each wraps exactly one expensive/external resource
           behind an interface).
Layer:     component
May import:   app.config, domain/* (types only)
Must NOT import:  services/*, api/*, other components/*
"""
