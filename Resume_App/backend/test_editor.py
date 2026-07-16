from line_editor import apply_direct_edit

text = """Mircea Dascalu
(+40) 746570202

EXPERIENCE
Full Stack / AI Solutions Developer at Beenear: 2019 - Present
- Co-developed a new company application
Technical Analyst / Full Stack Developer at UBIS: 3 Years
- Performed technical analysis
Full Stack Developer at BSS ONE: 9 Months
- Built web applications"""

prompt = (
    'make these 2 lines bold: '
    '"Technical Analyst / Full Stack Developer at UBIS: 3 Years", '
    '"Full Stack Developer at BSS ONE: 9 Months" '
    '- same font size and weight as '
    '"Full Stack / AI Solutions Developer at Beenear: 2019 - Present"'
)

result, msg = apply_direct_edit(text, prompt)
if result:
    print("SUCCESS:", msg)
    print("---")
    for line in result.split("\n"):
        print(repr(line))
else:
    print("FAILED:", msg)
