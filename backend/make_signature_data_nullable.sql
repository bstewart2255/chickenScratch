-- Make signature_data nullable (since stroke_data is the new primary storage)
ALTER TABLE signatures ALTER COLUMN signature_data DROP NOT NULL;