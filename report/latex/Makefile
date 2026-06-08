TEX       := report.tex
PDF       := report.pdf
LATEXMK   := latexmk -pdf -interaction=nonstopmode -file-line-error
CLEAN_EXT := aux bbl blg fdb_latexmk fls log out toc synctex.gz

.PHONY: all clean distclean

all: $(PDF)

$(PDF): $(TEX) references.bib
	$(LATEXMK) $(TEX)

clean:
	$(foreach ext,$(CLEAN_EXT),rm -f *.$(ext);)

distclean: clean
	rm -f $(PDF)
