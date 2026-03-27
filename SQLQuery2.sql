INSERT INTO Users (FullName, Email, PhoneNumber, PasswordHash, Role, IsActive, CreatedAt)
VALUES
('System Admin', 'admin@kuryon.local', '5550000001', 'Admin123!', 'admin', 1, GETDATE()),
('Ali Veli', 'courier@kuryon.local', '5550000002', 'Courier123!', 'courier', 1, GETDATE());
SELECT * FROM Users;