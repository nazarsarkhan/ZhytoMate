"""
Purpose:   Periodic TTL reaper: DELETE expired rows every 600s via repository; started/stopped from lifespan.
Layer:     background
May import:   components/repository (interface), app.config
Must NOT import:  api/*, services/*, schemas/*, domain/*
"""
