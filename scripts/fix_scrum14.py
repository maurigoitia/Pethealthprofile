"""SCRUM-14: Fix user enumeration en LoginScreen.tsx"""
import re

path = '/Users/mauriciogoitia/Pethealthprofile/src/app/components/auth/LoginScreen.tsx'
with open(path, 'r') as f:
    content = f.read()

# 1. Remove fetchSignInMethodsForEmail from import
content = content.replace('  fetchSignInMethodsForEmail,\n', '')

# 2. Replace the block that reveals auth method to a generic error
old_block = re.compile(
    r'const genericCredentialError =\s+'
    r'"Correo o contraseña incorrectos.*?"\s*;\s*'
    r'try \{.*?fetchSignInMethodsForEmail.*?\} catch \{.*?setError\(genericCredentialError\);\s*\}',
    re.DOTALL
)

new_block = '// SCRUM-14: Error genérico — no revelar si el email existe o método de auth\n        setError("Correo o contraseña incorrectos. Revisá tus datos e intentá nuevamente.");'

result = old_block.sub(new_block, content)

if result == content:
    print("WARNING: Pattern not found, trying manual replace")
    # Fallback manual
    start = content.find('const genericCredentialError =')
    end = content.find('} catch {\n          setError(genericCredentialError);\n        }', start)
    if start != -1 and end != -1:
        end = end + len('} catch {\n          setError(genericCredentialError);\n        }')
        result = content[:start] + '// SCRUM-14: Error genérico — no revelar si el email existe o método de auth\n        setError("Correo o contraseña incorrectos. Revisá tus datos e intentá nuevamente.");' + content[end:]
        print("Fallback replace applied")
    else:
        print("ERROR: Could not find pattern")
        exit(1)
else:
    print("Pattern replaced successfully")

with open(path, 'w') as f:
    f.write(result)
print("LoginScreen.tsx updated ✅")
