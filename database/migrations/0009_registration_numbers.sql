-- SPDX-License-Identifier: GPL-3.0-only
-- Registration numbers are public display identifiers, separate from immutable Wiki UIDs.
CREATE TABLE user_registration_numbers (
  registration_number INTEGER PRIMARY KEY AUTOINCREMENT CHECK(registration_number BETWEEN 1 AND 9007199254740991),
  uid TEXT NOT NULL UNIQUE REFERENCES users(uid)
);

-- Legacy creation timestamps have second precision; UID breaks ties deterministically.
INSERT INTO user_registration_numbers(uid)
SELECT uid FROM users ORDER BY created_at, uid;

-- All account creation paths allocate a number in the same transaction as the user.
-- Pending email registrations do not create users and therefore do not reserve numbers.
CREATE TRIGGER assign_registration_number AFTER INSERT ON users
BEGIN
  INSERT INTO user_registration_numbers(uid) VALUES(NEW.uid);
END;

CREATE TRIGGER immutable_registration_number BEFORE UPDATE ON user_registration_numbers
BEGIN
  SELECT RAISE(ABORT, 'immutable registration number');
END;

CREATE TRIGGER prevent_registration_number_replacement BEFORE INSERT ON user_registration_numbers
WHEN EXISTS(SELECT 1 FROM user_registration_numbers WHERE uid=NEW.uid OR registration_number=NEW.registration_number)
BEGIN
  SELECT RAISE(ABORT, 'immutable registration number');
END;

CREATE TRIGGER retain_registration_number BEFORE DELETE ON user_registration_numbers
BEGIN
  SELECT RAISE(ABORT, 'immutable registration number');
END;
