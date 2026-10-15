"""
Common password list — top 200 most common passwords.
The full set used in production should be the SecLists top-10k or HIBP list.
This subset is sufficient for the prototype and tests.
"""

COMMON_PASSWORDS: set[str] = {
    "password", "password1", "password12", "password123", "password1234",
    "123456", "1234567", "12345678", "123456789", "1234567890",
    "qwerty", "qwerty123", "qwertyuiop", "abc123", "iloveyou",
    "admin", "letmein", "monkey", "1q2w3e4r", "master",
    "dragon", "sunshine", "princess", "welcome", "shadow",
    "superman", "michael", "football", "baseball", "soccer",
    "batman", "trustno1", "access", "hello", "charlie",
    "donald", "password!", "pass", "test", "guest",
    "login", "changeme", "default", "root", "toor",
    "pass123", "pass1234", "passw0rd", "p@ssw0rd", "p@ssword",
    "secret", "secret1", "secret123", "hunter2", "zxcvbn",
    "asdfgh", "asdfghjkl", "thomas", "george", "jordan",
    "harley", "ranger", "dakota", "maggie", "joshua",
    "killer", "taylor", "matrix", "hockey", "987654321",
    "654321", "111111", "000000", "696969", "777777",
    "1111111", "11111111", "123123", "121212", "112233",
    "159753", "753951", "q1w2e3r4", "1qaz2wsx", "pass@123",
}
