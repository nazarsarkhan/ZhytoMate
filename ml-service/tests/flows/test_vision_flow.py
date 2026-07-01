"""
Purpose:   Flow: valid JSON path; malformed JSON => retry => valid; still-invalid => is_valid:false; out-of-range severity rejected.
Layer:     test
May import:   pytest, app.services.vision_service, tests.fakes.fake_generator, app.schemas/*
Must NOT import:  real google-genai (scripted fake only)
"""
